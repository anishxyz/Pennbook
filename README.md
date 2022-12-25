#Pennbook


Features:
User login and registration with error handling (username duplicates, etc.)
Home page with all of your friends, friend's posts, and an article suggestion
Each post has an offcanvas view, where you and view post comments
Create post page
Friend visualizer with a graph of friends, only expands to users of same affiliation
User pages with all posts of that user, ability to post on this user's wall, and basic information about the user
Edit account page that auto-posts updates to affiliation and news interests
Search bar that asyncronously updates search suggestions
Search results that shows all users that match the search and news articles that match the search
Articles showing in the feed of each user that is updated when the adsorption graph is updated
Ability to invite friends who are online to chats via the home page
Ability to create group chats and persistent chats

Source Files:
articles - Config.java, ComputeRanks.java, MyPair.java, SocialRankJob.java, ComputeRanks.java, SparkConnector.java, App.java, LoadArticles.java
views - chat.ejs, createpost.ejs, editaccount.ejs, home.ejs, loginpage.ejs, search.ejs, signup.ejs, user.ejs, visualizer.ejs
routes.js
app.js
database.js

Declaration: All of the code submitted was written by us.

Instructions: update AWS credentials to those of G26, install and use node version 18.2.1, run 'npm install', run 'node app.js'
Libraries (you may need to install these separately):
crypto-js (https://www.npmjs.com/package/crypto-js) - for hasing passwords
uuid (https://www.npmjs.com/package/uuid) - for generating random id's
vis-network (https://www.npmjs.com/package/vis-network) - for visualizer
stemmer (https://www.npmjs.com/package/stemmer) - for news search
socket.IO (https://socket.io) - for chat

Instructions for articles:
The article loader can be run by doing "mvn exec:java@load" while in the articles folder. Currently, the loader for the inverted article keyword table must be run manually, by switching the line that runs LoadArticles.load to LoadArticles.loadInverted.
In addition, the code for generating the adsorption graph and uploading articles by weight for each user is run by doing "mvn exec:java@local" while in the articles_src folder. This was run on an hourly schedule using a cron job with the timing "0 * * * *" for running the previous command.

Instructions for DynamoDB: Need the tables indicated in tables.png

Built with:
Anish Agrawal
Amay Tripathi 
Kasyap Chakravadhanula 
Aneesh Boreda 
