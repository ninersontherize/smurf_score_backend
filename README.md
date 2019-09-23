# smurf_score_backend
Welcome to the Smurf Score Back-end repository

## Smurf Account
![Smurf](/smurf.png)

## Normal Account
![Normal Account](/not-smurf.png)

## Instructions

In order to get your front end up and running you need to have node.js 
and mongodb installed on your machine and then we need to run a script
to install the proper dependencies.

First run this:

### `npm install`

Then we need to set up our mongodb instance, at the command line after mongodb
has been installed, type the following to start up the local server.

### `mongod`

Then, in a new tab with the server running, run the following command in your active
directory

### `mongo`

After you run this you should end up with a cli input like this >
at this input type the following

### > `use smurf_score`

It should give you a confirmation message, and you are almost done!
open up a new tab and run the following in our active directory

### `nodemon server`

When you run this you should see a message that says
"MongoDB database connection established successfully"
and at that point you should be good to go! If you already set up 
the front end you can access and localhost:3000 and get searching!

# Smurf Score Explaination

I've weighted the smurf score to not only look at gameplay statistics
but also account history and level, therefore, it is possible to have a
negative smurf score, this is intended, in fact most players will have a negative
smurf score if they are of a high enough level and played a lot of games this season

Anything above 20 is probably suspicious and anything above 50 is a pretty good bet
for a smurf. If the player is above 100 it is very obvious they are playing beneath
their level on purpose.
