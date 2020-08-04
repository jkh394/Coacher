# Coacher


## Inspiration

My inspiration for this web application stems from my volunteer internship at Stand Beside Them, which is a nonprofit dedicated to providing free coaching services for veterans. These coaching services are remotely held via phone or Skype and involves a volunteer coach who provides guidance and expertise to a veteran, their coachee, on various areas such as career development, small business development, life & relationships, etc.
 I noticed that the nonprofit was keeping track of its coaching sessions with Google Spreadsheets, which was inefficient as the organization would have to manually create a spreadsheet for each coaching agreement as well as reach out to each coach to remind them to fill out the spreadsheet once a session took place. After searching for an existing software that would solve this problem, I discovered that the current available technology for nonprofits is only focused towards individual volunteership for specific events and none that focuses specifically on keeping track of volunteer coaching engagements. It was thanks to this realization that Coacher was born!

## What it does

Coacher is a web application that is designed to keep track of coaching sessions between a coach and coachee. There are two kinds of users that can use this app: the admin (aka the nonprofit) and the volunteer coach. 

The admin user has the following abilities: 
* view all coaches 
* view all coachees 
* add a coachee 
* view all coaching sessions 
* create a coaching session 

The coach user has the following abilities: 
* view coaching sessions specific to the coach 
* update information about a specific coaching session

## How I built it

Coacher was built using Node.js as the runtime environment and Express.js as the back-end framework. MongoDB and Mongoose were used for the database and Handlebars.js was used to create reusable webpage templates for the application.

## Challenges I ran into

One of the main challenges I faced was implementing a secure user registration/login feature into the web application, as I did not have previous experience in doing so. I discovered that having just a user fill out their username and password is not secure enough since if the user's password is stored as plain text, it is available for anyone to read. The solution I came to for this problem was bcrypt, which is a password-hashing function and is on a password after salting it. Other minor challenges involve small css/html/jquery questions that were easily solved after a quick StackOverflow search :)

## Accomplishments that I'm proud of

Firstly being able to create a web application on my own! This hackathon was the perfect opportunity to take what I learned in class and apply it outside, and also forced me to actually stick to working on developing the web application with its deadline. I am also proud of being able to solve any problems I came across with coding thus far on my own without giving up, but that doesn't mean I won't be posting on online forums or utilizing spaces to ask for help if needed in the future!

## What I learned

I learned how to prioritize what to code in order to come up with a MVP. In the beginning of the development process, I was focused on the appearance of the web application and not on its actual functions, which cost me some time and prevented me from being able to deploy the application before the hackathon's deadline. In the future I hope to prevent this and deal with making sure the application actually does what it needs to do before focusing on other details.

## What's next for Coacher

In two words: so much! Besides actually deploying the app, there's a lot of things that can be done to improve Coacher such as: 
* implementing a calendar user interface to keep track of sessions 
~~ send reminder emails to coaches when a session is about to occur ~~
* give the admin user the ability to add or remove additional fields to any form 
* add additional details about a coach such as a headshot, their coaching specialties, etc. 
* ability to export database info as a file, to Google Spreadsheet, etc.
* ...and more!
