//  6/2/2023 run using command `npm run dev` can be found in package.json under scripts

//  Lincoln's code
const express = require("express");
const path = require("path");
const port = 8088;
const crypto = require("crypto");
const bcrypt = require("bcrypt");

//  Used to read the user login information and parse it. Gonzales + Lincoln
const bodyParser = require("body-parser");

//  The cookie parser is used to store login information. Gonzales + Lincoln
var cookieParser = require("cookie-parser");

var utils = require("./utils");

const app = express();
const PORT = 8088;

const SALT_ROUNDS = 10;

// Set the view engine to ejs
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: false }));

app.use(cookieParser());

//  This is Express middleware that is used to log access to certain pages in the console.
//  Mostly for reference.
function logger(req, res, next) {
    console.log(
        `Received request ... [${Date.now()}] ${req.method} ${req.url}`
    );
    next();
}
app.use(logger);

//  Express JSON middleware
app.use(express.json());

//This is error handling middleware to catch errors in page requests
function handleErrors(err, req, res, next) {
    console.log(err);
    res.status(err.httpStatusCode || 500).send("Oh no, an error occurred!");
}

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});

/*
----------------------------------------
|            Mongo Stuff               |
----------------------------------------
*/

//  Lincoln - This is some code I assembled to connect a web-hosted database to the javascript.
const { MongoClient } = require("mongodb");
const { error } = require("console");
const { create } = require("domain");

const uri = "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+1.9.0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri);

//  This is a try/catch to ensure that the database connection is successful.
async function dbconnect() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        console.log("You have successfully connected to MongDB");
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
    }
}
dbconnect().catch(console.dir);

const db = client.db("CBProjects");

let personnel;
let projects;

async function filldata() {
    personnel = await db.collection("personnel").find().toArray();
    projects = await db.collection("projects").find().toArray();
}

filldata();

//  Going to localhost itself will simply redirect to the login screen
app.get("/", (req, res) => {
    res.redirect("/login");
});

//  Going to the login page will display the HTML.
app.get("/login", (req, res) => {
    res.render("pages/login");
});

//  Going to the projects page. Lincoln + Gonzales
app.get("/projects", async (req, res) => {
    //  This code checks to see if credentials are successful and stored as a cookie
    if (req.cookies.login == "true") {
        res.render("pages/index", {
            personnel: personnel,
            projects: projects,
            utils: utils,
        });
    } else {
        //  Redirects to login page if the credentials are not successfully stored
        res.redirect("/login");
    }
});

app.post("/login", async (req, res) => {
    //  This is a function that exists within the app.post. On submit, this code will execute.
    //  Body parser into JSON
    var { username, password } = req.body;

    const user = await db
        .collection("personnel")
        .findOne({ "account.username": username });
    console.log(user);

    //  Simple code for now to check if login is correct. However, this will change once we access users in the database.
    if (user && (await bcrypt.compare(password, user.account.password))) {
        // Assign the cookie. Name of 'login' (change name depending on user or admin), then boolean true since login was successful
        res.cookie("login", true);
        // Take the user to the projects page after successful login
        res.redirect("/projects");
    } else {
        // If credentials are incorrect, redirect to the login page
        res.redirect("/login");
    }
});



async function createPerson(person) {
  //generate new ID and insert into db
  person._id = crypto.randomUUID();
  db.collection("personnel").insertOne(person, (err, result) => {
      if (err) {
          console.error("Failed to insert person:", err);
      }
  });
  return person._id;
}
async function createProject(project) {
  //generate new ID and insert into db
  project._id = crypto.randomUUID();
  db.collection("projects").insertOne(project, (err, result) => {
      if (err) {
          console.error("Failed to insert project:", err);
      }
  });
  return project._id;
}

async function changeRole(projectID, personID, role) {
  const projectQuery = { _id: projectID };
  const personQuery = { _id: personID };

  //create and load the person and project objects with queries
  let person, project;
  try {
      person = await db.collection("personnel").findOne(personQuery);
      project = await db.collection("projects").findOne(projectQuery);
      if (!person || !project) {
          console.log("Result not found");
          return;
      }
  } catch (error) {
      console.log("ERROR: " + error);
  }

  const assignments = person.projects;
  const members = project.members;

  // THERE CAN ONLY BE ONE!
  if (role === "Lead") {
      for (let member of members) {
          if (member.role === "Lead") delete member.role;
      }
  }

  // Find index of assignment and member
  const assignmentIndex = assignments.findIndex(
      (assignment) => assignment.id === projectID
  );
  const memberIndex = members.findIndex((member) => member.id === personID);

  // Check if assignment and member were found
  if (assignmentIndex === -1 || memberIndex === -1) {
      return;
  }

  // Update the role
  assignments[assignmentIndex].role = role;
  members[memberIndex].role = role;

  // push to database
  try {
      await db.collection("personnel").updateOne(personQuery, {
          $set: { projects: assignments },
      });
      await db.collection("projects").updateOne(projectQuery, {
          $set: { members: members },
      });
  } catch (error) {
      console.log("ERROR: " + error);
  }
}

// Post new projects into the database, should activate on submit
// Ensure that the action of the modal corresponds to /projects/upload
app.post('/projects', (req, res)=>{
  //code to input a new user into the database
  if("addNewPerson" in req.body){
      createPerson({
        firstName : req.body.fName,
        lastName : req.body.lName,
        account: {}
      })
      res.redirect('/projects')
  }
  if("addNewProject" in req.body){
    createProject({
      name : req.body.projName,
      description : req.body.projDesc,
      members : []
    })
    res.redirect('projects')
  }

  if("addNewLead" in req.body){
    let projID = req.body.addNewLead
    let persID = req.body.checkLead
    let role = "Lead"
    changeRole(projID, persID, role)
    res.redirect('/projects')
  }



  // code to add a person from the list of people to a project
  if("addPersonnelToProject" in req.body){
    
    let projID = req.body.addPersonnelToProject
    console.log("Project ID: "+ projID)
    
    // code that grabs the id of each person assigned to the project you chose
    let people = req.body.checkPerson

    try{

    people.forEach(id => {
      db.collection("projects").updateOne({
        //query, find in projects where _id = unique id
        _id : projID
        },
        // push into members list the array of
        {
          $push : {
            "members": {id}
          }}
        
      ) 
    });

    console.log("success")
    }catch(e){
      console.log(e)
    }
  }

})

// code that will allow you to log out and clear your cookie
app.get('/logout', (req, res) => {
  console.log(req.cookies.login)
  res.clearCookie('login')
  res.render('pages/logout')
  })









