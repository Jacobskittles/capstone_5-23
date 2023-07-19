//  6/2/2023 run using command `npm run dev` can be found in package.json under scripts

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

const secretKey = "this_is_the_key_shhh";

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
        const payload = {
            user_id: user._id,
            first_name: user.firstName,
            last_name: user.lastName,
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

// DBManager has all of the functions for accessing the database
const DBMan = new DBManager(
    db.collection("projects"),
    db.collection("personnel")
);

// Post new projects into the database, should activate on submit
// Ensure that the action of the modal corresponds to /projects/upload
// Lincoln's code
app.post("/projects", async (req, res) => {
    if (req.user.admin) {
        console.log(req.user.admin);
        try {
            //code to input a new user into the database
            if ("addNewPerson" in req.body) {
                // call createProject from DB manager and fill with inputted data from req.body
                DBMan.createPerson({
                    firstName: req.body.fName,
                    lastName: req.body.lName,
                    account: {},
                });
                // updates the page immediately with the updated database
                await filldata();
                res.redirect("/projects");
            }
            //code to input a new project into the database
            if ("addNewProject" in req.body) {
                // call createProject from DB manager and fill with inputted data from req.body
                DBMan.createProject({
                    name: req.body.projName,
                    description: req.body.projDesc,
                    members: [],
                });
                await filldata();
                res.redirect("/projects");
            }
            // code to add a new lead to the project
            if ("addNewLead" in req.body) {
                const projID = req.body.addNewLead;
                console.log(req.body.addNewLead);
                console.log(req.body.checkLead);
                const persID = req.body.checkLead;
                await DBMan.join(projID, persID)
                const role = "Lead";
                await DBMan.changeRole(projID, persID, role);
                await filldata();
                res.redirect("/projects");
            }
            // code to add a person from the list of people to a project
            if ("addPersonnelToProject" in req.body) {
                const projID = req.body.addPersonnelToProject;
                //conditional to check if there is one or more people (if one, turn the object into array. if more, it is already an array.)
                const people = Array.isArray(req.body.checkPerson)
                    ? req.body.checkPerson
                    : [req.body.checkPerson];
                // iterate through the array of people to join them to the project
                for (person of people) {
                    await DBMan.join(projID, person);
                }

                await filldata();
                res.redirect("/projects");
            }

            if ("editProject" in req.body) {
                projName = req.body.projName;
                projDesc = req.body.projDesc;
                projID = req.body.editProject;
                await DBMan.updateProject(projID, {
                    name: projName,
                    description: projDesc,
                });
                await filldata();
                res.redirect("/projects");
            }

            if ("deleteProject" in req.body) {
                projID = req.body.deleteProject;
                console.log(`Deleting project with ID: ${projID}`);
                await DBMan.deleteProject(projID);
                await filldata();
                res.redirect("/projects");
            }

            if ("deletePerson" in req.body) {
                personID = req.body.deletePerson;
                console.log(`Deleting person with ID: ${personID}`);
                await DBMan.deletePerson(personID);
                await filldata();
                res.redirect("/projects");
            }

            if ("editPerson" in req.body) {
                personName = req.body.firstName;
                personLastName = req.body.lastName;
                personID = req.body.editPerson;
                await DBMan.updateProject(personID, {
                    firstname: personName,
                    lastname: personlastName,
                });
                await filldata();
                res.redirect("/projects");
            }

            if ("removePersonnel" in req.body) {
                const projID = req.body.removePersonnel;
                const people = Array.isArray(req.body.checkRemovePerson)
                    ? req.body.checkRemovePerson
                    : [req.body.checkRemovePerson];
                // like adding a list of people to a project, iterate through the array to remove 1 or more from the list
                for (person of people) {
                    await DBMan.unjoin(projID, person);
                }
                await filldata();
                res.redirect("/projects");
            }
        } catch (error) {
            // Handle errors
            console.error(error);
            res.status(500).send("An error occurred.");
        }
    }
});

// code that will allow you to log out and clear your cookie
app.get("/logout", (req, res) => {
    console.log(req.cookies.login);
    res.clearCookie("jwt");
    res.render("pages/logout");
});
