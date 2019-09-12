//
// Copyright (c) 2016-2019 Cisco Systems
// Licensed under the MIT License 
//

const got = require("got");

const debug = require("debug")("sparkbot:utils");
const fine = require("debug")("sparkbot:utils:fine");

const Registration = {};
module.exports = Registration;


// Create a WebHook, see https://developer.webex.com/endpoint-webhooks-post.html for specs
//
// cb function signature should be (err, webhook)
//
Registration.createWebhook = function (token, name, targetUrl, resource, event, filter, secret, cb) {

   // Build the post string from an object
   const post_data = {
      'name': name,
      'resource': resource,
      'event': event,
      'targetUrl': targetUrl
   };
   if (filter) {
      post_data.filter = filter;
   }
   if (secret) {
      post_data.secret = secret;
   }

   // Request instance
   const client = got.extend({
      baseUrl: process.env.WEBEX_API || 'https://api.ciscospark.com/v1',
      headers: {
         'authorization': 'Bearer ' + token
      }
   });

   // Invoke Webex API
   const path = '/webhooks';
   (async () => {
      try {
         const response = await client.post(path, {
            body: post_data,
            json: true,
            responseType: 'json'
         });
         fine(`POST ${path} received a: ${response.statusCode}`);

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
         const webhook = response.body;
         fine("webhook created, id: " + webhook.id);
         if (cb) cb(null, webhook);

      } catch (error) {
         fine(`error while invoking: ${path}, code: ${error.code}`)
         debug("cannot create the webhook, error: " + error.message);
         if (cb) cb(new Error("cannot create the webhook"), null);
      }
   })();
}


// Deletes a WebHook
//
// cb function signature should be (err, statusCode)
//
Registration.deleteWebhook = function (token, webhookId, cb) {

   // Request instance
   const client = got.extend({
      baseUrl: process.env.WEBEX_API || 'https://api.ciscospark.com/v1',
      headers: {
         'authorization': 'Bearer ' + token
      },
      json: true
   });

   // Invoke Webex API
   const resource = '/webhooks/' + webhookId;
   (async () => {
      try {
         const response = await client.delete(resource);
         fine(`DELETE ${resource} received a: ${response.statusCode}`);

         switch (response.statusCode) {
            case 204:
               break; // we're good, let's proceed

            case 401:
               debug("Webex authentication failed: 401, bad token");
               if (cb) cb(new Error("response status: " + response.statusCode + ", bad token"), null);
               return;

            default:
               debug("could not delete Webhook, status code: " + response.statusCode);
               if (cb) cb(new Error("response status: " + response.statusCode), null);
               return;
         }

         if (cb) cb(null, 204);

      } catch (error) {
         fine(`error in ${resource}, code: ${error.code}`)
         ddebug("cannot delete the webhook, error: " + error.message);
         if (cb) cb(new Error("cannot delete the webhook"), null);
      }
   })();
}



// Lists WebHooks
//
// cb function signature should be (err, webhooks)
//
Registration.listWebhooks = function (token, cb) {

   // Request instance
   const client = got.extend({
      baseUrl: process.env.WEBEX_API || 'https://api.ciscospark.com/v1',
      headers: {
         'authorization': 'Bearer ' + token
      },
      json: true
   });

   // Invoke Webex API
   const resource = '/webhooks';
   (async () => {
      try {
         const response = await client.get(resource);
         fine(`GET ${resource} received a: ${response.statusCode}`);

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
         var payload = response.body;
         if (!payload || !payload.items) {
            debug("could not retreive Webhooks, malformed payload: ");
            if (cb) cb(new Error("Could not retreive Webhooks, malformed payload"), null);
            return;
         }

         // Return webhooks
         if (cb) cb(null, payload.items);

      } catch (error) {
         fine(`error in ${resource}, code: ${error.code}`)
         debug("cannot list webhooks, error: " + error.message);
         if (cb) cb(new Error("cannot lists webhooks"), null);
      }
   })();

}

