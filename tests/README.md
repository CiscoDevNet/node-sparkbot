# Library tests

A set of examples to discover the framework's features : 

- [onEvent-all-all](onEvent-all-all.js), [onEvent-messages-created](onEvent-messages-created.js): examples of listeners to specific Webhook (Resources/Event) triggers. Leverages node-sparkbot function: webhook.onEvent().

- [onMessage](onMessage.js): examples of listeners invoked when new message contents are succesfully fetched from Webex. Leverages node-sparkbot function: webhook.onMessage(). 

- [onMessage-asCommand](onMessage-asCommand.js): illustrates how to interpret the message as a bot command. Leverages node-sparkbot function: webhook.onMessage().

- [onCommand](onCommand.js): shortcut to listen to a specific command. Leverages node-sparkbot function: webhook.onCommand().

- [onCommand-webhook](onCommand-webhook.js): example of an automated creation of a webhook.


You may also check [express-webhook](express-webhook.js) which illustrates how to create a bot without any library :

- [express-webhook](express-webhook.js): a simple HTTP service based on Express, listening to incoming Resource/Events from Webex Teams


## Run locally

Each sample can be launched from the same set of command lines install then run calls.

Note that the ACCESS_TOKEN env variable is required to run all samples that read message contents.

Once your bot is started, read this [guide to expose it publically and create a Webex Teams webhook](../docs/SettingUpYourSparkBot.md).


```shell
# Installation
git clone https://github.com/CiscoDevNet/node-sparkbot
cd node-sparkbot
npm install

# Run
cd tests
DEBUG=sparkbot* ACCESS_TOKEN=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX node onCommand.js
...
Webex Teams Bot started at http://localhost:8080/
   GET  / for Healthcheck
   POST / to receive Webhook events
```




 