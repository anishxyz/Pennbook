# Pennbook

![](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![](https://img.shields.io/badge/Bootstrap-563D7C?style=for-the-badge&logo=bootstrap&logoColor=white)
![](https://img.shields.io/badge/Amazon%20DynamoDB-4053D6?style=for-the-badge&logo=Amazon%20DynamoDB&logoColor=white)
![](https://img.shields.io/badge/Amazon_AWS-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)
![](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)

<img width="2056" alt="Screenshot 2022-12-22 at 5 10 31 PM" src="https://user-images.githubusercontent.com/25111855/209485482-29c9bef4-244d-4bb2-9aae-9b24e56102da.png">

## Features
User login and registration with error handling (username duplicates, etc.)
<br>Home page with all of your friends, friend's posts, and an article suggestion
<br>Each post has an offcanvas view, where you and view post comments
<br>Create post page
<br>Friend visualizer with a graph of friends, only expands to users of same affiliation
<br>User pages with all posts of that user, ability to post on this user's wall, and basic information about the user
<br>Edit account page that auto-posts updates to affiliation and news interests
<br>Search bar that asyncronously updates search suggestions
<br>Search results that shows all users that match the search and news articles that match the search
<br>Articles showing in the feed of each user that is updated when the adsorption graph is updated
<br>Ability to invite friends who are online to chats via the home page
<br>Ability to create group chats and persistent chats

## Source Files
articles - Config.java, ComputeRanks.java, MyPair.java, SocialRankJob.java, ComputeRanks.java, SparkConnector.java, App.java, LoadArticles.java
<br>views - chat.ejs, createpost.ejs, editaccount.ejs, home.ejs, loginpage.ejs, search.ejs, signup.ejs, user.ejs, visualizer.ejs
<br>routes.js
<br>app.js
<br>database.js


## Instructions
update AWS credentials to those of G26, install and use node version 18.2.1, run 'npm install', run 'node app.js'
#### Libraries (you may need to install these separately):
crypto-js (https://www.npmjs.com/package/crypto-js) - for hasing passwords
<br>uuid (https://www.npmjs.com/package/uuid) - for generating random id's
<br>vis-network (https://www.npmjs.com/package/vis-network) - for visualizer
<br>stemmer (https://www.npmjs.com/package/stemmer) - for news search
<br>socket.IO (https://socket.io) - for chat
#### Instructions for articles:
The article loader can be run by doing "mvn exec:java@load" while in the articles folder. Currently, the loader for the inverted article keyword table must be run manually, by switching the line that runs LoadArticles.load to LoadArticles.loadInverted.
<br>In addition, the code for generating the adsorption graph and uploading articles by weight for each user is run by doing "mvn exec:java@local" while in the articles_src folder. This was run on an hourly schedule using a cron job with the timing "0 * * * *" for running the previous command.
#### Instructions for DynamoDB: 
Need the tables indicated in tables.png

## Screenshots
<img width="2056" alt="Screenshot 2022-12-22 at 5 11 16 PM" src="https://user-images.githubusercontent.com/25111855/209485558-f129e536-f5ff-4d5b-b2ef-712489ec4aad.png">
<img width="2055" alt="Screenshot 2022-12-22 at 5 11 39 PM" src="https://user-images.githubusercontent.com/25111855/209485560-2ceee415-35e6-4016-939c-ae604044651c.png">
<img width="688" alt="Screenshot 2022-12-25 at 4 19 13 PM" src="https://user-images.githubusercontent.com/25111855/209485613-e176061c-5be8-4559-b842-a1d87f8837ad.png">
<img width="2056" alt="Screenshot 2022-12-22 at 5 06 25 PM" src="https://user-images.githubusercontent.com/25111855/209485557-fe2c3bad-65d8-4879-9d10-176f194d0ded.png">
<img width="2053" alt="Screenshot 2022-12-22 at 5 11 25 PM" src="https://user-images.githubusercontent.com/25111855/209485556-fbbee852-0956-4fc7-836e-651df798dff4.png">

#### Built with <3 by Anish Agrawal, Amay Tripathi, Kasyap Chakravadhanula, Aneesh Boreda   
