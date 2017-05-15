//
// Copyright (c) 2016 Cisco Systems
// Licensed under the MIT License 
//

var https = require("https");
var htmlparser = require("htmlparser2");

var debug = require("debug")("sparkbot:interpreter");
var fine = require("debug")("sparkbot:interpreter:fine");



var sparkAccounts = ["machine", "human", "unknown"];

/* Helper library to interpret Spark commands as they flow in
 * Please invoke with a valid Webhook configuration
 */
function CommandInterpreter(config) {
    this.token = config.token;
    if (!this.token) {
        debug("token required, skipping interpreter initialization...");
        return;
    }
    
    // Set defaults 
    this.trimMention = config.trimMention ? config.trimMention : true;
    this.prefix = config.commandPrefix ? config.commandPrefix : "";
    // if not specified, default will be set in detectSparkAccount function 
    if (config.ignoreSelf) {
        this.ignoreSelf = config.ignoreSelf;
    }
    
    // Let's identify the account type and finalize configuration in there
    this.accountType = "unknown";
	this.person = null;
    var self = this;
	detectSparkAccount(this.token, function(err, account, people) {
        if (err) {
            debug("could not retreive account type, err: " + err + ", continuing...");
            return;
        }

		self.accountType = account;
		self.person = people;

        // Decode Spark Account id identifier to better trim mentions (see trimMention)
        var temp = new Buffer(people.id, 'base64');
        self.person.rawId = temp.toString().substring(23);

        // Infer how Cisco Spark would generate a nick name for the bot,
        // which is approximate as the nick name would depend on the name of other room members...
        var splitted = people.displayName.split(' ');
	    self.nickName = splitted[0];

        // If ignoreSelf is not explicitely set, let's initialize it 
        if (!self.ignoreSelf) {
            if (self.accountType == "machine") {
                self.ignoreSelf = true;
            }
            else {
                self.ignoreSelf = false;
            }
        }
	});

}


// Return a string in which webhook mentions are removed
// Note : we need to start from the HTML text as it only includes mentions for sure. In practice, the plain text message may include a nickname 
function trimMention(person, message) {
    var buffer = "";
    var skip = 0;
    var group = 0;      
    var parser = new htmlparser.Parser({
        onopentag: function(tagname, attribs){
            fine("opening brace name: " + tagname + ", with args: " + JSON.stringify(attribs));
            if (tagname === "spark-mention") {
                if (attribs["data-object-type"]=="person" && attribs["data-object-id"]== person.id ) {
                        skip++; // to skip next text as bot was mentionned
                }

                // [Workaround] for Spark Mac clients, see issue https://github.com/CiscoDevNet/node-sparkbot/issues/1
                if (attribs["data-object-type"]=="person" && attribs["data-object-id"]== person.rawId ) {
                        skip++; // to skip next text as bot was mentionned
                }
            }
        },
        ontext: function(text){
            if (!skip) {
                fine("appending: " + text);
                if (group > 0) {
                    buffer += " ";
                }
                buffer += text.trim();
                group++;
            }
            else {
                skip--; // skipped, let's continue HTML parsing in case other bot mentions appear
                group = 0;
            }
        },
        onclosetag: function(tagname){
             fine("closing brace name: " + tagname);
        }
    }, {decodeEntities: true});
    parser.parseComplete(message.html);

    debug("trimed: " + buffer);
    return buffer;
}


// checks if a command can be extracted, if so, returns it, and null otherwise.
// extra features
//      - can trim bot name when the bot is mentionned
//      - can filter out messages from bot
CommandInterpreter.prototype.extract = function (message) {
    // If the message comes from the bot, ignore it
    if (this.ignoreSelf && (message.personId === this.person.id)) {
        debug("bot is writing => ignoring");
        return null;
    }

    // Remove mention if we are running a bot account and part of a group room
    var text = message.text;
    if  ((message.roomType == "group") && (this.accountType == "machine") && this.trimMention) {
        debug("removing bot mention if present in: " + text);
        text = trimMention(this.person, message);
    }

    // Remove extra whitespaces
    text = text.replace( /\s\s+/g, " ");

    // If the message does not contain any text, simply ignore it
    // GTK: happens in case of a pure file attachement for example
    if (!text) {
        debug("no text in message => ignoring");
        return null;
    }

    // If it is not a command, ignore it
    var prefixLength = 0;
    if (this.prefix) {
        prefixLength = this.prefix.length;

        // Check if prefix matches
        if (this.prefix != text.substring(0, prefixLength)) {
            debug("text does not start with the command prefix: " + this.prefix + " => ignoring...");
            return null;
        }
    }

    // Extract command
    var splitted = text.substring(prefixLength).split(' ');
    var keyword = splitted[0];
    if (!keyword) {
        debug("empty command, ignoring");
        return null;        
    }
    splitted.shift();

    var command = { "keyword": keyword, "args": splitted, "message":message };
    debug("detected command: " + command.keyword + ", with args: " + JSON.stringify(command.args) + ", in message: " + command.message.id);
    return command;
}



// Detects account type by invoking the Spark People ressource
//    - HUMAN if the token corresponds to a bot account, 
//    - BOT otherwise
//
// cb function signature should be (err, type, account) where type: HUMAN|BOT, account: People JSON structure
//
function detectSparkAccount(token, cb) {
	//console.log("checking Spark account");
	var options = {
						'method': 'GET',
						'hostname': 'api.ciscospark.com',
						'path': '/v1/people/me',
						'headers': {'authorization': 'Bearer ' + token}
					};
	var req = https.request(options, function (response) {
		var chunks = [];
		response.on('data', function (chunk) {
			chunks.push(chunk);
		});
		response.on("end", function () {
            switch (response.statusCode) {
                case 200:
                    break; // we're good, let's proceed
            
                case 401:
                    debug("Spark authentication failed: 401, bad token");
                    cb(new Error("response status: " + response.statusCode + ", bad token"), null, null);
                    return;

                default: 
                    debug("could not retreive Spark account, status code: " + response.statusCode);
                    cb(new Error("response status: " + response.statusCode), null, null);
                    return;
            }
				
			// Robustify
			var payload = JSON.parse(Buffer.concat(chunks));
			if (!payload.emails) {
                debug("could not retreive Spark account, unexpected payload");
				cb(new Error("unexpected payload: not json"), null, null);
                return;
			}
			var email = payload.emails[0];
			if (!email) {
                debug("could not retreive Spark account, unexpected payload: no email");
				cb(new Error("unexpected payload: no email"), null, null);
                return;
			}

			// Check if email corresponds to a spark bot
			var splitted = email.split("@");
			if (!splitted || (splitted.length != 2)) {
                debug("could not retreive Spark account, malformed email");
				cb(new Error("unexpected payload: malformed email"), null, null);
                return;
			}
			var domain = splitted[1];
			if ('sparkbot.io' == domain) {
				debug("bot account detected, name: " + payload.displayName);
				cb(null, "machine", payload);
                return;	
			} 

			debug("human account detected, name: " + payload.displayName);
			cb(null, "human", payload);
		});
	});
	req.on('error', function(err) {
		debug("cannot find a Spark account for token, error: " + err);
		cb(new Error("cannot find Spark account for token"), null, null);
	});
	req.end();
}


module.exports = CommandInterpreter;