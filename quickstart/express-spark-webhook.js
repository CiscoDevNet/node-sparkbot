//
// Copyright (c) 2016 Cisco Systems
// Licensed under the MIT License 
//

/* 
 * a Cisco Spark webhook based on pure Express.js.
 * 
 * goal here is to illustrate how to create a bot without any library
 *
 */

var express = require("express");
var app = express();

var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

var debug = require("debug")("samples");
var Utils = require("../sparkbot/utils");


var started = Date.now();
app.route("/")
    // healthcheck
    .get(function (req, res) {
        res.json({
            message: "Congrats, your Cisco Spark bot is up and running",
            since: new Date(started).toISOString(),
            code: "express-all-in-one.js",
            tip: "Register your bot as a WebHook to start receiving events: https://developer.ciscospark.com/endpoint-webhooks-post.html"
        });
    })

    // webhook endpoint
    .post(function (req, res) {
        
        // analyse incoming payload, should conform to Spark webhook trigger specifications
        debug("DEBUG: webhook invoked");
        if (!req.body || !Utils.checkWebhookEvent(req.body)) {
            console.log("WARNING: Unexpected payload POSTed, aborting...");
            res.status(400).json({message: "Bad payload for Webhook",
                                    details: "either the bot is misconfigured or Cisco Spark is running a new API version"});
            return;
        }

        // event is ready to be processed, let's send a response to Spark without waiting any longer
        res.status(200).json({message: "message is being processed by webhook"});

        // process incoming resource/event, see https://developer.ciscospark.com/webhooks-explained.html
        processWebhookEvent(req.body);
    });


// Starts the Bot service
//
// [WORKAROUND] in some container situation (ie, Cisco Shipped), we need to use an OVERRIDE_PORT to force our bot to start and listen to the port defined in the Dockerfile (ie, EXPOSE), 
// and not the PORT dynamically assigned by the host or scheduler.
var port = process.env.OVERRIDE_PORT || process.env.PORT || 8080;
app.listen(port, function () { 
    console.log("Cisco Spark Bot started at http://localhost:" + port + "/");
    console.log("   GET  / for health checks");
    console.log("   POST / to procress new Webhook events");
});


// Invoked when the Spark webhook is triggered
function processWebhookEvent(trigger) {

    //
    // YOUR CODE HERE
    //
    console.log("EVENT: " + trigger.resource + "/" + trigger.event + ", with data id: " + trigger.data.id + ", triggered by person id:" + trigger.actorId);
      
}