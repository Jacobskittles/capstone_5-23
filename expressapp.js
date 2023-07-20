//  6/2/2023 run using command `npm run dev` can be found in package.json under scripts

// Lincoln - Sanitize function: call this on req.params to sanitize them.
var sanitize = require("mongo-sanitize");

//  Lincoln's code
const express = require("express");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

//  Used to read the user login information and parse it. Gonzales + Lincoln
const bodyParser = require("body-parser");

//  The cookie parser is used to store login information. Gonzales + Lincoln
var cookieParser = require("cookie-parser");

var utils = require("./utils");
const DBManager = require("./DBManager");

const app = express();
const PORT = 8088;

const secretKey =
    "93dc6c4e2962459eb1f71a88888c7e5a5e9d6bae431eaa6d2bd131712e5c317672b9e6b5a7df2a4c4f20ee41ff42e1c07489905c73802fd8f414994770242990";

// not used with bcrypt compare
// const SALT_ROUNDS = 10;

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

// Middleware to verify the JWT and set the user in the request object
// Gonzales
const authenticateToken = (req, res, next) => {
    const token = req.cookies.jwt; // Assuming you set the JWT as 'jwt' in the cookie

    if (!token) {
        // No token found, user is not authenticated
        return res.redirect("/login");
    }

    // Verify the JWT and extract the payload
    jwt.verify(token, secretKey, (err, payload) => {
        if (err) {
            // Invalid token or expired
            return res.redirect("/login");
        }

        // Attach the payload (user information) to the request object for use in the route handler
        req.user = payload;

        // Proceed to the next middleware or route handler
        next();
    });
};

/*
----------------------------------------
|            Mongo Stuff               |
----------------------------------------
*/

//  Lincoln - This is some code I assembled to connect a web-hosted database to the javascript.
const { MongoClient } = require("mongodb");
const { error } = require("console");
const { create } = require("domain");

const uri =
    "mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+1.9.0";

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

// Gonzales - fill page with data
async function filldata() {
    personnel = await db.collection("personnel").find().toArray();
    projects = await db.collection("projects").find().toArray();
}

filldata();

//  Lincoln - Going to localhost itself will simply redirect to the login screen
app.get("/", (req, res) => {
    res.redirect("/login");
});

//  Lincoln - Going to the login page will display the HTML.
app.get("/login", (req, res) => {
    res.render("pages/login");
});

//  Going to the projects page. Lincoln + Gonzales
app.get("/projects", authenticateToken, async (req, res) => {
    console.log(req.user);
    filldata();
    res.render("pages/index", {
        personnel: personnel,
        projects: projects,
        utils: utils,
        user: req.user,
    });
});

// Gonzales/Lincoln - Posting user login requirements to the database
app.post("/login", async (req, res) => {
    var { username, password } = sanitize(req.body);

    const user = await db
        .collection("personnel")
        .findOne({ "account.username": username });
    console.log(user);

    //  Gonzales - Simple code for now to check if login is correct. However, this will change once we access users in the database.
    if (user && (await bcrypt.compare(password, user.account.password))) {
        const payload = {
            user_id: user._id,
            first_name: user.firstName,
            last_name: user.lastName,
            username: user.account.username,
            admin: user.account.admin,
        };

        // Create the JWT and sign it with a secret key
        const token = jwt.sign(payload, secretKey, { expiresIn: "24h" });

        // Assign the cookie. Name of 'login' (change name depending on user or admin), then boolean true since login was successful
        res.cookie("jwt", token, { httpOnly: true, secure: true });
        // Take the user to the projects page after successful login
        res.redirect("/projects");
    } else {
        // If credentials are incorrect, redirect to the login page
        res.redirect("/login");
    }
});

// Gonzales - DBManager has all of the functions for accessing the database
const DBMan = new DBManager(
    db.collection("projects"),
    db.collection("personnel")
);

// Lincoln and Slivinski's Code - Posts to the database depending on the name and values associated with the modal or submit buttons that you are pressing in order to keep the site limited to one page.
app.post("/projects", authenticateToken, async (req, res) => {
    if (req.user.admin) {
        console.log(req.user.admin);
        try {
            //code to input a new user into the database
            if ("addNewPerson" in req.body) {
                // call createProject from DB manager and fill with inputted data from req.body
                let firstName = sanitize(req.body.firstName);
                let lastName = sanitize(req.body.lastName);
                await DBMan.createPerson({
                    firstName: firstName,
                    lastName: lastName,
                    account: {},
                });
                console.log(
                    `New person with name ${firstName} ${lastName} successfully created`
                );
                // updates the page immediately with the updated database
                await filldata();
                res.redirect("/projects");
            }
            // Lincoln - This code adds a new project to the database
            if ("addNewProject" in req.body) {
                let projectName = sanitize(req.body.projectName);
                let projectDescription = sanitize(req.body.projectDescription);
                // call createProject from DB manager and fill with inputted data from req.body
                await DBMan.createProject({
                    name: projectName,
                    description: projectDescription,
                    members: [],
                });
                console.log(
                    `New project with name ${projectName} successfully created`
                );
                await filldata();
                res.redirect("/projects");
            }
            // Lincoln - This code adds a new lead to a project without a lead
            if ("addNewLead" in req.body) {
                let projectID = sanitize(req.body.addNewLead);
                let personID = sanitize(req.body.checkLead);
                let role = "Lead";
                console.log(
                    `Adding member ${personID} as lead to ${projectID}...`
                );
                await DBMan.changeRole(projectID, personID, role);
                console.log(
                    `Member ${personID} successfully added as lead to ${projectID}`
                );
                await filldata();
                res.redirect("/projects");
            }
            // Lincoln - This code changes a lead from one person to another if the lead position is already filled. Cannot remove a lead and make it empty unless the person is removed entirely from the project.
            if ("changeLead" in req.body) {
                let projectID = sanitize(req.body.changeLead);
                let personID = sanitize(req.body.checkChangeLead);
                let role = "Lead";
                console.log(
                    `Changing lead role for project ${projectID} to member ${personID}...`
                );
                await DBMan.changeRole(projectID, personID, role);
                console.log(
                    `Lead role for project ${projectID} successfully changed to member ${personID}`
                );
                await filldata();
                res.redirect("/projects");
            }
            // Lincoln - This code adds a member or members to a project
            if ("addMembersToProject" in req.body) {
                let projectID = sanitize(req.body.addMembersToProject);
                selectAddMembers = sanitize(req.body.selectAddMembers);
                //conditional to check if there is one or more members (if one, turn the object into array. if more, it is already an array.)
                let members = Array.isArray(selectAddMembers)
                    ? selectAddMembers
                    : [selectAddMembers];
                console.log(
                    `Adding members with IDs ${members} to project ${projectID}...`
                );
                // iterate through the array of members to join them to the project
                for (member of members) {
                    await DBMan.join(projectID, member);
                }
                console.log(
                    `Members with IDs ${members} successfully added to project ${projectID}`
                );
                await filldata();
                res.redirect("/projects");
            }
            // Lincoln - This code removes a member or members from a project
            if ("removeMembersFromProject" in req.body) {
                let projectID = sanitize(req.body.removeMembersFromProject);
                let selectRemoveMembers = sanitize(
                    req.body.selectRemoveMembers
                );
                let members = Array.isArray(selectRemoveMembers)
                    ? selectRemoveMembers
                    : [selectRemoveMembers];
                console.log(
                    `Removing member(s) with IDs: ${members} from project ${projectID}...`
                );
                // like adding a list of members to a project, iterate through the array to remove 1 or more from the list
                for (member of members) {
                    await DBMan.unjoin(projectID, member);
                }
                console.log(
                    `Members successfully removed from project: ${projectID}`
                );
                await filldata();
                res.redirect("/projects");
            }
            // Lincoln - This code edits the project name and/or description
            if ("editProject" in req.body) {
                let projectName = sanitize(req.body.projectName);
                let projectDesc = sanitize(req.body.projectDescription);
                let projectID = sanitize(req.body.editProject);
                console.log(`Editing project with ID: ${projectID}...`);
                await DBMan.updateProject(projectID, {
                    name: projectName,
                    description: projectDesc,
                });
                console.log(
                    `Successfully updated project with ID: ${projectID}`
                );
                await filldata();
                res.redirect("/projects");
            }
            // Lincoln - This code deletes a project from the database
            if ("deleteProject" in req.body) {
                let projectID = sanitize(req.body.deleteProject);
                console.log(`Deleting project with ID: ${projectID}`);
                await DBMan.deleteProject(projectID);
                console.log(
                    `Successfully deleted project with ID: ${projectID}`
                );
                await filldata();
                res.redirect("/projects");
            }
            // Slivinski - This code deletes a person entirely from the database
            if ("deletePerson" in req.body) {
                personID = sanitize(req.body.deletePerson);
                console.log(`Deleting person with ID: ${personID}`);
                await DBMan.deletePerson(personID);
                console.log(`Successfully deleted person with ID: ${personID}`);
                await filldata();
                res.redirect("/projects");
            }
            // Slinky - This code edits the first name and/or last name of a person
            if ("editPerson" in req.body) {
                let personID = sanitize(req.body.editPerson);
                let firstName = sanitize(req.body.firstName);
                let lastName = sanitize(req.body.lastName);
                console.log(
                    `Editing person information with ID: ${personID}...`
                );
                await DBMan.updatePerson(personID, {
                    firstName: firstName,
                    lastName: lastName,
                });
                console.log(`Successfully updated person with ID: ${personID}`);
                await filldata();
                res.redirect("/projects");
            }
        } catch (error) {
            // General error handling function
            console.error(error);
            res.status(500).send("An error occurred.");
        }
    }
});

// Lincoln/Gonzales - code that will allow you to log out and clear your cookie
app.get("/logout", (req, res) => {
    console.log(req.cookies.login);
    res.clearCookie("jwt");
    // timed logout splash
    res.render("pages/logout");
});

app.get("/export", authenticateToken, async (req, res) => {
    if (req.user.admin) {
        const collection = req.query.collection;
        const format = req.query.format;
        let jsonData;
        if (collection === "personnel") {
            jsonData = await DBMan.exportJSON("personnel");
        } else if (collection === "projects") {
            jsonData = await DBMan.exportJSON("projects");
        } else {
            return res.status(400).send("Invalid collection.");
        }

        // if (format === "json") {
        res.send(JSON.stringify(jsonData, null, 2));
        // } else {
        //     return res.status(400).send("Invalid format.");
        // }
    } else {
        res.status(403).send("Unauthorized");
    }
});
