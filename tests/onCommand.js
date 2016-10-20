//
// Copyright (c) 2016 Cisco Systems
// Licensed under the MIT License 
//

/* 
 * a Cisco Spark webhook that leverages a simple library (batteries included)
 * 
 * note : this example requires that you've set a SPARK_TOKEN env variable 
 *  
 */

var SparkBot = require("../sparkbot/webhook");

// Starts your Webhook with default configuration where the SPARK API access token is read from the SPARK_TOKEN env variable 
var bot = new SparkBot();
 
bot.onCommand("help", function(command) {

  //
  // ADD YOUR CUSTOM CODE HERE
  //  
  console.log("new command: " + command.keyword + ", from: " + command.message.personEmail + ", with args: " + JSON.stringify(command.args));
  
});
