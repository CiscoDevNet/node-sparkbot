//
// Copyright (c) 2016-2019 Cisco Systems
// Licensed under the MIT License 
//

var got = require("got");
var htmlparser = require("htmlparser2");

var debug = require("debug")("sparkbot:interpreter");
var fine = require("debug")("sparkbot:interpreter:fine");



var sparkAccounts = ["machine", "human", "unknown"];

/* Helper library to interpret commands as they flow in
 * Please invoke with a valid Webhook configuration
 */
function CommandInterpreter(config) {
   this.token = config.token;
   if (!this.token) {
      debug("token required, skipping interpreter initialization...");
      return;
   }

   // A bot should ignore its own messages by default
   // Only case when this would be set to true is for a developer to test a bot with its personal developer token
   if (typeof this.ignoreSelf != "boolean") {
      this.ignoreSelf = true;
   }

   // No prefix to commands by default
   this.prefix = config.commandPrefix ? config.commandPrefix : "";

   // Bot Mentions should be trimmed by default
   if (typeof this.trimMention != "boolean") {
      this.trimMention = true;
   }

   // Let's identify the account type and finalize configuration in there
   this.accountType = "unknown";
   this.person = null;
   var self = this;
   detectAccount(this.token, function (err, account, people) {
      if (err) {
         debug("could not retreive account type, err: " + err + ", continuing...");
         return;
      }

      self.accountType = account;
      self.person = people;

      // Decode account id identifier to better trim mentions (see trimMention)
      var temp = Buffer.from(people.id, 'base64');
      self.person.rawId = temp.toString().substring(23);

      // Infer how Webex would generate a nickname for the bot,
      // which is approximate as the nick name would depend on the name of other room members...
      var splitted = people.displayName.split(' ');
      self.nickName = splitted[0];
   });

}


// Return a string in which webhook mentions are removed
// Note : we need to start from the HTML text as it only includes mentions for sure. In practice, the plain text message may include a nickname 
function trimMention(person, message) {

   // If the message does not contain HTML, no need parsing it for Mentions
   if (!message.html) {
      return message.text;
   }

   var buffer = "";
   var skip = 0;
   var group = 0;
   var parser = new htmlparser.Parser({
      onopentag: function (tagname, attribs) {
         fine("opening brace name: " + tagname + ", with args: " + JSON.stringify(attribs));
         if (tagname === "spark-mention") {
            if (attribs["data-object-type"] == "person" && attribs["data-object-id"] == person.id) {
               skip++; // to skip next text as bot was mentionned
            }

            // [Workaround] for Mac clients, see issue https://github.com/CiscoDevNet/node-sparkbot/issues/1
            if (attribs["data-object-type"] == "person" && attribs["data-object-id"] == person.rawId) {
               skip++; // to skip next text as bot was mentionned
            }
         }
      },
      ontext: function (text) {
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
      onclosetag: function (tagname) {
         fine("closing brace name: " + tagname);
      }
   }, { decodeEntities: true });
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


   // If the message does not contain any text, simply ignore it
   // GTK: happens in case of a pure file attachement for example
   var text = message.text;
   if (!text) {
      debug("no text in message => ignoring");
      return null;
   }

   // Remove mention if in a group room
   if ((message.roomType == "group") && this.trimMention) {
      if (message.mentionedPeople && (message.mentionedPeople.length > 0)) {
         fine("removing bot mentions if present in: " + text);
         text = trimMention(this.person, message);
      }
   }

   // Remove extra whitespaces
   text = text.replace(/\s\s+/g, " ");
   if (!text) {
      debug("no text in message after trimming => ignoring");
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

   var command = { "keyword": keyword, "args": splitted, "message": message };
   debug("detected command: " + command.keyword + ", with args: " + JSON.stringify(command.args) + ", in message: " + command.message.id);
   return command;
}



// Detects account type by invoking the Webex Teams People ressource
//    - HUMAN if the token corresponds to a bot account, 
//    - BOT otherwise
//
// cb function signature should be (err, type, account) where type: HUMAN|BOT, account: People JSON structure
//
function detectAccount(token, cb) {
   fine("checking account");

   const client = got.extend({
      baseUrl: process.env.WEBEX_API || 'https://api.ciscospark.com/v1',
      headers: {
         'authorization': 'Bearer ' + token
      },
      json: true
   });

   (async () => {
      try {
         const response = await client.get('/people/me');
         fine(`/people/me received a ${response.statusCode}`);

         switch (response.statusCode) {
            case 200:
               break; // we're good, let's proceed

            case 401:
               debug("Webex Teams authentication failed: 401, bad token");
               cb(new Error("response status: " + response.statusCode + ", bad token"), null, null);
               return;

            default:
               debug("could not retreive Webex Teams account, status code: " + response.statusCode);
               cb(new Error("response status: " + response.statusCode), null, null);
               return;
         }

         // Robustify
         const payload = response.body;
         if (!payload.emails) {
            debug("could not retreive Webex Teams account, unexpected payload");
            cb(new Error("unexpected payload: not json"), null, null);
            return;
         }
         var email = payload.emails[0];
         if (!email) {
            debug("could not retreive Webex Teams account, unexpected payload: no email");
            cb(new Error("unexpected payload: no email"), null, null);
            return;
         }

         // Check if email corresponds to a bot
         var splitted = email.split("@");
         if (!splitted || (splitted.length != 2)) {
            debug("could not retreive Spark account, malformed email");
            cb(new Error("unexpected payload: malformed email"), null, null);
            return;
         }
         var domain = splitted[1];
         // [COMPATIBILITY] Keeping sparkbot.io for backward compatibility
         if (('webex.bot' === domain) || ('sparkbot.io' === domain)) {
            debug("bot account detected, name: " + payload.displayName);
            cb(null, "machine", payload);
            return;
         }

         debug("human account detected, name: " + payload.displayName);
         cb(null, "human", payload);

      } catch (error) {
         fine(`error in /people/me, code: ${error.code}`)
         debug("cannot find a Webex Teams account for specified token, error: " + error.message);
         cb(new Error("cannot find Webex Teams account for specified token"), null, null);
      }
   })();
}


module.exports = CommandInterpreter;