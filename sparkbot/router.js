//
// Copyright (c) 2016-2019 Cisco Systems
// Licensed under the MIT License 
//

var debug = require("debug")("sparkbot:router");
var fine = require("debug")("sparkbot:router:fine");


/*
 * Listener to new (messages/created) Webhook events which does routing based on command keyword
 */
function CommandRouter(webhook) {
    this.commands = {};
    
    // add router as (messages/created) listener
    if (!webhook) {
        debug("webhook required, skipping router initialization...");
        return;
    }
    this.webhook = webhook;

    var self = this;
    webhook.onMessage(function(trigger, message) {
        var command = webhook.asCommand(message);
        if (!command || !command.keyword) {
            debug("could not interpret message as a command, aborting..."); 
            return;
        }
            
        fine("new command: " + command.keyword + ", with args: " + JSON.stringify(command.args));
        var listener = self.commands[command.keyword];
        if (!listener) {
            fine("no listener for command: " + command.keyword);

            // Looking for a fallback listener 
            listener = self.commands["fallback"];
            if (listener) {
                debug("found fallback listener => invoking");
                listener(command);
            }
            return;
        }

        debug("firing new command: " + command.keyword);
        listener(command);
    });
}


CommandRouter.prototype.addCommand = function (command, listener) {
    // Robustify
    if (!command ||!listener) {
        debug("addCommand: bad arguments, aborting...");
        return;
    }

    debug("added listener for command: " + command);
    this.commands[command] = listener;
}


module.exports = CommandRouter;