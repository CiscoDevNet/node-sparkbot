//
// Copyright (c) 2016-2019 Cisco Systems
// Licensed under the MIT License 
//

var https = require("https");
var querystring = require('querystring');

var debug = require("debug")("sparkbot:utils");
var fine = require("debug")("sparkbot:utils:fine");

var Registration = {};
module.exports = Registration;


// Create a WebHook, see https://developer.webex.com/endpoint-webhooks-post.html for specs
//
// cb function signature should be (err, webhook)
//
Registration.createWebhook = function (token, name, targetUrl, resource, event, filter, secret, cb) {

  // Build the post string from an object
  var post_data = JSON.stringify({
     'name':name,
     'resource': resource,
     'event': event,
     'targetUrl': targetUrl,
     'filter' : filter,
     'secret': secret 
  });

  // An object of options to indicate where to post to
  var post_options = {
      host: 'api.ciscospark.com',
      path: '/v1/webhooks',
      method: 'POST',
      headers: {
		  'Authorization' : 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(post_data)
      }
  };

	var req = https.request(post_options, function (response) {
		var chunks = [];
		response.on('data', function (chunk) {
			chunks.push(chunk);
		});
		response.on("end", function () {
            switch (response.statusCode) {
                case 200:
                    break; // we're good, let's proceed
            
                case 401:
                    debug("Webex authentication failed: 401, bad token");
                    if (cb) cb(new Error("response status: " + response.statusCode + ", bad token"), null);
                    return;

                default: 
                    debug("could not create WebHook, status code: " + response.statusCode);
                    if (cb) cb(new Error("response status: " + response.statusCode), null);
                    return;
            }
				
			// [TODO] Robustify by checking the payload format

			// Return
			var webhook = JSON.parse(Buffer.concat(chunks));
			fine("webhook created, id: " + webhook.id);
			if (cb) cb(null, webhook);
		});
	});
	
	// post the data
	req.on('error', function(err) {
		debug("cannot find create the webhook, error: " + err);
		if (cb) cb(new Error("cannot find create the webhook"), null);
	});
	req.write(post_data);
	req.end();
}


// Deletes a WebHook
//
// cb function signature should be (err, statusCode)
//
Registration.deleteWebhook = function (token, webhookId, cb) {

  // An object of options to indicate where to post to
  var req_options = {
      host: 'api.ciscospark.com',
      path: '/v1/webhooks/' + webhookId,
      method: 'DELETE',
      headers: {
		  'Authorization' : 'Bearer ' + token
      }
  };

	var req = https.request(req_options, function (response) {
		var chunks = [];
		response.on('data', function (chunk) {
			chunks.push(chunk);
		});
		response.on("end", function () {
            switch (response.statusCode) {
                case 204:
                    break; // we're good, let's proceed
            
                case 401:
                    debug("Webex authentication failed: 401, bad token");
                    if (cb) cb(new Error("response status: " + response.statusCode + ", bad token"), null);
                    return;

                default: 
                    debug("could not delete Webhook, status code: " + response.statusCode);
                    if (cb)  cb(new Error("response status: " + response.statusCode), null);
                    return;
            }
				
            if (cb) cb(null, 204);
		});
	});
	
	// post the data
	req.on('error', function(err) {
		debug("cannot delete the webhook, error: " + err);
		if (cb) cb(new Error("cannot delete the webhook"), null);
	});
	req.end();
}



// Lists WebHooks
//
// cb function signature should be (err, webhooks)
//
Registration.listWebhooks = function (token, cb) {

  // An object of options to indicate where to post to
  var req_options = {
      host: 'api.ciscospark.com',
      path: '/v1/webhooks/',
      method: 'GET',
      headers: {
		  'Authorization' : 'Bearer ' + token
      }
  };

	var req = https.request(req_options, function (response) {
		var chunks = [];
		response.on('data', function (chunk) {
			chunks.push(chunk);
		});
		response.on("end", function () {
            switch (response.statusCode) {
                case 200:
                    break; // we're good, let's proceed
            
                case 401:
                    debug("Webex authentication failed: 401, bad token");
					if (cb) cb(new Error("response status: " + response.statusCode + ", bad token"), null);
                    return;

                default: 
                    debug("could not retreive Webhook, status code: " + response.statusCode);
					if (cb) cb(new Error("response status: " + response.statusCode), null);
                    return;
            }
				
			// [TODO] Robustify by checking the payload format
			var payload = JSON.parse(Buffer.concat(chunks));
			if (!payload || !payload.items) {
				debug("could not retreive Webhooks, malformed payload: ");
				if (cb) cb(new Error("Could not retreive Webhooks, malformed payload"), null);
                return;
			}

            // Return webhooks
			if (cb) cb(null, payload.items);
		});
	});
	req.on('error', function(err) {
		debug("cannot list webhooks, error: " + err);
		if (cb) cb(new Error("cannot lists webhooks"), null);
	});
	req.end();
}

