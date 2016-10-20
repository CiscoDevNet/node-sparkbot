# Sparkbot tests

A set of samples to discover the framework's features : 

- [onEvent-all-all](onEvent-all-all.js), [onEvent-messages-created](onEvent-messages-created.js): examples of listeners to specific Webhook (Resources/Event) triggers. Leverages Sparkbot function: webhook.onEvent().

- [onMessage](onMessage.js): examples of listeners invoked when new message contents are succesfully fetched from Spark. Leverages Sparkbot function: webhook.onMessage(). 

- [onMessage-asCommand](onMessage-asCommand.js): illustrates how to interpret the message as a bot command. Leverages Sparkbot function: webhook.onMessage().

- [onCommand](onCommand.js): shortcut to listen to a specific command. Leverages Sparkbot function: webhook.onCommand().


You may also check [express-spark-webhook](express-spark-webhook.js) which illustrates how to create a bot without any library :

- [express-spark-webhook](express-spark-webhook.js): a simple HTTP service based on Express, listening to incoming Resource/Events from Cisco Spark


## Run locally

Each sample can be launched from the same set of command lines install then run calls.

Note that the SPARK_TOKEN env variable is required to run all samples that read message contents.

Once your bot is started, read this [guide to expose it publically and create a Cisco Spark webhook](../docs/HowToRegisterOnSpark.md).


``` bash
# Installation
> git clone https://github.com/CiscoDevNet/node-sparkbot
> cd node-sparkbot
> npm install

# Run
> cd tests
> DEBUG=sparkbot* SPARK_TOKEN=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX node onCommand.js
Cisco Spark Bot started at http://localhost:8080/
   GET  / for Healthcheck
   POST / to receive Webhook events
```




 