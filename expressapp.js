//  6/2/2023 run using command `npm run dev` can be found in package.json under scripts

//  Lincoln's code
const express = require("express");
const path = require("path");
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
        filldata()
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
  try{
    person._id = crypto.randomUUID();
    await db.collection("personnel").insertOne(person);
    console.log("Person created")
    return person._id;
  }catch(error){
    console.error("Failed to insert person:", error)
    throw error
  }
}

async function createProject(project) {
  try{
    project._id = crypto.randomUUID();
    await db.collection("projects").insertOne(project)
    console.log("Project created")
    return project._id;
  } catch(error){
    console.error("Failed to insert project:", error)
    throw error;
  }
  
}

async function changeRole(projectID, personID, role) {
  try {
    const projectQuery = { _id: projectID };
    const personQuery = { _id: personID };

    // Fetch the person and project from the database
    const person = await db.collection("personnel").findOne(personQuery);
    const project = await db.collection("projects").findOne(projectQuery);

    if (!person || !project) {
      console.log("Result not found");
      return;
    }

    const assignments = person.projects;
    const members = project.members;

    // Remove existing "Lead" role if it exists
    members.forEach(member => {
      if (member.role === "Lead") {
        delete member.role;
      }
    });

    // Find index of assignment and member
    const assignmentIndex = assignments.findIndex(assignment => assignment.id === projectID);
    const memberIndex = members.findIndex(member => member.id === personID);

    // Check if assignment and member were found
    if (assignmentIndex === -1 || memberIndex === -1) {
      console.log("Result not found");
      return;
    }

    // Update the role
    assignments[assignmentIndex].role = role;
    members[memberIndex].role = role;

    // Update the database with the modified data
    await db.collection("personnel").updateOne(personQuery, { $set: { projects: assignments } });
    await db.collection("projects").updateOne(projectQuery, { $set: { members: members } });

    console.log("Role changed successfully");
  } catch (error) {
    console.error("Failed to change role:", error);
    throw error;
  }
}

async function join(projectID, personID) {
  try {
    const projectQuery = { _id: projectID };
    const personQuery = { _id: personID };

    const person = await db.collection("personnel").findOne(personQuery);
    const project = await db.collection("projects").findOne(projectQuery);

    if (!person || !project) {
      console.log("Result not found: " + person);
      return;
    }

    if (!person.projects) person.projects = [];
    if (!project.members) project.members = [];

    const assignment = person.projects.find((assignment) => assignment.id === projectID);
    const member = project.members.find((member) => member.id === personID);

    if ((assignment !== undefined) ^ (member !== undefined)) {
      console.log("Project and member improperly joined (?). Fixing...");
      if (!assignment) {
        const newAssignment = { id: projectID };
        if (member.role) newAssignment.role = member.role;
        person.projects.push(newAssignment);
      } else {
        const newMember = { id: personID };
        if (assignment.role) newMember.role = assignment.role;
        project.members.push(newMember);
      }
    } else if (!assignment && !member) {
      person.projects.push({ id: projectID });
      project.members.push({ id: personID });
    } else {
      // Already joined, no change needed
      return;
    }

    await db.collection("personnel").updateOne(personQuery, { $set: { projects: person.projects } });
    await db.collection("projects").updateOne(projectQuery, { $set: { members: project.members } });

    console.log(`Successfully joined ${id} to project`);
  } catch (error) {
    console.log("ERROR: " + error);
  }
}

async function updateProject(projectID, projectname, projectdesc) {
  const projectQuery = { _id: projectID };
  // let { name, description } = project;

  db.collection("projects").updateOne(projectQuery, { $set: { name : projectname, description : projectdesc} });
}
async function updatePerson(personID, person) {
  const personQuery = { _id: personID };
  let { firstName, lastName } = person;

  db.collection("personnel").updateOne(personQuery, { $set: { firstName, lastName } });
}
async function deletePerson(personID) {
  const personQuery = { _id: personID };

  let person;
  try {
      person = await db.collection("personnel").findOne(personQuery);
      if (!person) {
          console.log("Result not found");
          return;
      }
  } catch (error) {
      console.log("ERROR: " + error);
  }

  // get rid of all joins
  for (assignment of person.projects) {
      unjoin(assignment.id, personID);
  }

  personnel.deleteOne(personQuery, (err, result) => {
      if (err) {
          console.error("Failed to delete person: ", err);
      }
  });
}
async function deleteProject(projectID) {
  const projectQuery = { _id: projectID };

  let project;
  try {
      project = await db.collection("projects").findOne(projectQuery);
      if (!project) {
          console.log("Result not found");
          return;
      }
  } catch (error) {
      console.log("ERROR: " + error);
  }

  // get rid of all joins
  for (member of project.members) {
      unjoin(projectID, member.id);
  }

    db.collection("projects").deleteOne(projectQuery, (err, result) => {
      if (err) {
          console.error("Failed to delete project: ", err);
      }
  });
}

// Post new projects into the database, should activate on submit
// Ensure that the action of the modal corresponds to /projects/upload
app.post('/projects', async(req, res)=>{
  try{
    //code to input a new user into the database
    if("addNewPerson" in req.body){
        createPerson({
          firstName : req.body.fName,
          lastName : req.body.lName,
          account: {}
        })
        await filldata();
        res.redirect('/projects');
    }
    //code to input a new project into the database
    if("addNewProject" in req.body){
      createProject({
        name : req.body.projName,
        description : req.body.projDesc,
        members : []
      })
      await filldata();
      res.redirect('/projects');
    }
    //code to add a new lead to the project
    if("addNewLead" in req.body){
      let projID = req.body.addNewLead
      let persID = req.body.checkLead
      let role = "Lead"
      changeRole(projID, persID, role)
      await filldata();
      res.redirect('/projects');
    }
    // code to add a person from the list of people to a project
    if ("addPersonnelToProject" in req.body) {
      const projID = req.body.addPersonnelToProject;
      //conditional to check if there is one or more people (if one, turn the object into array. if more, it is already an array.)
      const people = Array.isArray(req.body.checkPerson)
        ? req.body.checkPerson
        : [req.body.checkPerson];
    
      for (person of people) {
        await join(projID, person);
      };
    
      await filldata();
      res.redirect('/projects');
    }

    if("editProject" in req.body){
      projName = req.body.projName
      projDesc = req.body.projDesc
      projID = req.body.editProject
      await updateProject(projID, projName, projDesc)
      await filldata();
      res.redirect('/projects');
    }
    
  }catch(error){
    // Handle errors
    console.error(error);
    res.status(500).send("An error occurred.");
  }
  })



// code that will allow you to log out and clear your cookie
app.get('/logout', (req, res) => {
  console.log(req.cookies.login)
  res.clearCookie('login')
  res.render('pages/logout')
  })









