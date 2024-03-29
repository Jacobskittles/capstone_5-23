//  6/2/2023 run using command `npm run dev` can be found in package.json under scripts

// Lincoln - Sanitize function: call this on req.params to sanitize them.
var sanitize = require("mongo-sanitize");

//  Lincoln's code
const express = require("express");

// for comparing hashed passwords
const bcrypt = require("bcrypt");

// for tokens
const jwt = require("jsonwebtoken");

// used only for generating a secret key
const crypto = require("crypto");

//  Used to read the user login information and parse it. Gonzales + Lincoln
const bodyParser = require("body-parser");

//  The cookie parser is used to store login information. Gonzales + Lincoln
var cookieParser = require("cookie-parser");

// gonzales' other files
var utils = require("./utils");
const DBManager = require("./DBManager");

// for uploading to server
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 80;

// for release:
const secretKey = crypto.randomBytes(32).toString("hex");

// for dev:
// const secretKey = "93dc6c4e2962459eb1f71a88888c7e5a5e9d6bae431eaa6d2bd131712e5c317672b9e6b5a7df2a4c4f20ee41ff42e1c07489905c73802fd8f414994770242990";

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

const upload = multer({
    dest: "./uploads/",
    limits: { fileSize: 2 * 1024 * 1024 },
});

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});

// Middleware to verify the JWT and set the user in the request object
// Gonzales
/**
 * Middleware to authenticate user with JSON Web Token (JWT).
 *
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The next middleware function to be called if the user is authenticated.
 */
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

/**
 * Middleware to check if the user is authorized as an admin.
 *
 * Checks if the user is authorized as an admin based on the presence of the `req.user` object and its `admin`
 * property. If the user is not authorized, it renders an error page with a "403 Unauthorized" status code.
 *
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {Function} next - The next middleware function in the chain.
 */
function adminAuth(req, res, next) {
    // Check if the user is authorized as an admin
    if (!req.user || !req.user.admin) {
        return showError(req, res, "Unauthorized", "403");
    }
    // If the user is authorized, proceed to the next middleware or route handler
    next();
}

/**
 * Renders an error page with a custom error message and error code.
 * If no custom error code or message is provided, a default value will be used.
 *
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @param {string} error - The custom error message to display. If not provided, a default empty string will be used.
 * @param {string} code - The custom error code to display. If not provided, a default value of "Error" will be used.
 */
function showError(req, res, error, code) {
    if (!code) {
        code = "Error";
    }
    if (!error) {
        error = "";
    }

    return res.status(400).render("pages/error", {
        error: error,
        code: code,
    });
}

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

//  Lincoln - Going to localhost itself will simply redirect to the project screen, which will redirect to login if fail credentials
app.get("/", (req, res) => {
    res.redirect("/projects");
});

//  Lincoln - Going to the login page will display the HTML.
app.get("/login", (req, res) => {
    res.render("pages/login");
});

//  Going to the projects page. Lincoln + Gonzales
app.get("/projects", authenticateToken, async (req, res) => {
    try {
        console.log(req.user);
        filldata();

        res.render("pages/index", {
            personnel: personnel,
            projects: projects,
            utils: utils,
            user: req.user,
        });
    } catch (error) {
        showError(req, res, error.message, "Internal Server Error");
    }
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
        // If credentials are incorrect, show scary error screen
        return showError(
            req,
            res,
            "Username or password incorrect.",
            "Login Failed"
        );
    }
});

// Gonzales - DBManager has all of the functions for accessing the database
const DBMan = new DBManager(
    db.collection("projects"),
    db.collection("personnel")
);

// Lincoln and Slivinski's Code - Posts to the database depending on the name and values associated with the modal or submit buttons that you are pressing in order to keep the site limited to one page.
app.post("/projects", authenticateToken, async (req, res) => {
    if (!req.user.admin) {
        // just redirect instead of showing error screen
        return res.status(403).redirect("/projects");
    }

    try {
        //code to input a new user into the database
        if ("addNewPerson" in req.body) {
            // call createProject from DB manager and fill with inputted data from req.body
            const firstName = sanitize(req.body.firstName);
            const lastName = sanitize(req.body.lastName);
            await DBMan.createPerson({
                firstName: firstName,
                lastName: lastName,
                account: {},
            });
            console.log(
                `New person with name ${firstName} ${lastName} successfully created`
            );
        }
        // Lincoln - This code adds a new project to the database
        else if ("addNewProject" in req.body) {
            const projectName = sanitize(req.body.projectName);
            const projectDescription = sanitize(req.body.projectDescription);
            // call createProject from DB manager and fill with inputted data from req.body
            await DBMan.createProject({
                name: projectName,
                description: projectDescription,
                members: [],
            });
            console.log(
                `New project with name ${projectName} successfully created`
            );
        }
        // Lincoln - This code changes a lead from one person to another if the lead position is already filled.
        else if ("changeLead" in req.body) {
            const projectID = sanitize(req.body.changeLead);
            const personID = sanitize(req.body.checkChangeLead);
            const role = "Lead";
            console.log(
                `Changing lead role for project ${projectID} to member ${personID}...`
            );
            await DBMan.changeRole(projectID, personID, role);
            console.log(
                `Lead role for project ${projectID} successfully changed to member ${personID}`
            );
        }
        // Lincoln - This code adds a member or members to a project
        else if ("addMembersToProject" in req.body) {
            const projectID = sanitize(req.body.addMembersToProject);
            const selectAddMembers = sanitize(req.body.selectAddMembers);
            //conditional to check if there is one or more members (if one, turn the object into array. if more, it is already an array.)
            const members = Array.isArray(selectAddMembers)
                ? selectAddMembers
                : [selectAddMembers];
            console.log(
                `Adding members with IDs ${members} to project ${projectID}...`
            );
            // iterate through the array of members to join them to the project
            for (let member of members) {
                await DBMan.join(projectID, member);
            }
            console.log(
                `Members with IDs ${members} successfully added to project ${projectID}`
            );
        }
        // Lincoln - This code removes a member or members from a project
        else if ("removeMembersFromProject" in req.body) {
            const projectID = sanitize(req.body.removeMembersFromProject);
            const selectRemoveMembers = sanitize(req.body.selectRemoveMembers);
            const members = Array.isArray(selectRemoveMembers)
                ? selectRemoveMembers
                : [selectRemoveMembers];
            console.log(
                `Removing member(s) with IDs: ${members} from project ${projectID}...`
            );
            // like adding a list of members to a project, iterate through the array to remove 1 or more from the list
            for (let member of members) {
                await DBMan.unjoin(projectID, member);
            }
            console.log(
                `Members successfully removed from project: ${projectID}`
            );
        }
        // Lincoln - This code edits the project name and/or description
        else if ("editProject" in req.body) {
            const projectName = sanitize(req.body.projectName);
            const projectDesc = sanitize(req.body.projectDescription);
            const projectID = sanitize(req.body.editProject);
            console.log(`Editing project with ID: ${projectID}...`);
            await DBMan.updateProject(projectID, {
                name: projectName,
                description: projectDesc,
            });
            console.log(`Successfully updated project with ID: ${projectID}`);
        }
        // Lincoln - This code deletes a project from the database
        else if ("deleteProject" in req.body) {
            const projectID = sanitize(req.body.deleteProject);
            console.log(`Deleting project with ID: ${projectID}`);
            await DBMan.deleteProject(projectID);
            console.log(`Successfully deleted project with ID: ${projectID}`);
        }
        // Slivinski - This code deletes a person entirely from the database
        else if ("deletePerson" in req.body) {
            const personID = sanitize(req.body.deletePerson);
            console.log(`Deleting person with ID: ${personID}`);
            await DBMan.deletePerson(personID);
            console.log(`Successfully deleted person with ID: ${personID}`);
        }
        // Slinky - This code edits the first name and/or last name of a person
        else if ("editPerson" in req.body) {
            const personID = sanitize(req.body.editPerson);
            const firstName = sanitize(req.body.firstName);
            const lastName = sanitize(req.body.lastName);
            console.log(`Editing person information with ID: ${personID}...`);
            await DBMan.updatePerson(personID, {
                firstName: firstName,
                lastName: lastName,
            });
            console.log(`Successfully updated person with ID: ${personID}`);
        } else if (req.body.function === "join") {
            const personID = sanitize(req.body.personID);
            const projectID = sanitize(req.body.projectID);

            await DBMan.join(projectID, personID);
        } else if (req.body.function === "changeLead") {
            const personID = sanitize(req.body.personID);
            const projectID = sanitize(req.body.projectID);

            await DBMan.changeRole(projectID, personID, "Lead");
        } else if (req.body.function === "unassign") {
            const personID = sanitize(req.body.personID);

            await DBMan.unassignPerson(personID)
        } else {
            return showError(req, res, "Invalid Request", 400);
        }

        // updates the page immediately with the updated database
        // I have no idea why but express won't wait for filldata to finish unless I use the result (undefined), so here we are, technically, doing the thing
        console.log(await filldata()); 
        res.redirect("/projects");
    } catch (error) {
        return showError(req, res, error.message);
    }
});

// Lincoln/Gonzales - code that will allow you to log out and clear your cookie
app.get("/logout", (req, res) => {
    console.log(req.cookies.login);
    res.clearCookie("jwt");
    // timed logout splash
    res.render("pages/logout");
});

// Gonzales
app.get("/export", authenticateToken, adminAuth, async (req, res) => {
    // Retrieve the collection and format from the query parameters
    const collection = req.query.collection;

    let jsonData;

    // Check the requested collection and fetch the corresponding data
    if (collection === "personnel") {
        jsonData = await DBMan.exportJSON(DBMan.personnel);
    } else if (collection === "projects") {
        jsonData = await DBMan.exportJSON(DBMan.projects);
    } else {
        // Return a 400 Bad Request response if an invalid collection is requested
        return showError(req, res, "Invalid collection name.");
    }

    // Send the JSON data in the specified format (defaulting to pretty-printed JSON)
    res.send(JSON.stringify(jsonData, null, 2));
});

app.get("/import", authenticateToken, adminAuth, async (req, res) => {
    res.render("pages/import");
});

app.post(
    "/import",
    authenticateToken,
    adminAuth,
    upload.fields([
        { name: "personnel", maxCount: 1 },
        { name: "projects", maxCount: 1 },
    ]),
    async (req, res) => {
        const personnelFile = req.files["personnel"];
        const projectsFile = req.files["projects"];

        try {
            if (personnelFile && personnelFile[0]) {
                const personnelData = fs.readFileSync(
                    personnelFile[0].path,
                    "utf8"
                );

                await DBMan.importJSON(DBMan.personnel, personnelData);

                // Delete the personnel file after importing
                fs.unlink(personnelFile[0].path, (err) => {
                    if (err) {
                        console.log(err);
                    }
                });
            }

            if (projectsFile && projectsFile[0]) {
                const projectsData = fs.readFileSync(
                    projectsFile[0].path,
                    "utf8"
                );

                await DBMan.importJSON(DBMan.projects, projectsData);

                // Delete the projects file after importing
                fs.unlink(projectsFile[0].path, (err) => {
                    if (err) {
                        console.log(err);
                    }
                });
            }
        } catch (error) {
            // Delete all files within the "uploads" folder, just in case
            const uploadsFolder = path.join(__dirname, "uploads");
            const files = fs.readdirSync(uploadsFolder);

            for (const file of files) {
                const filePath = path.join(uploadsFolder, file);
                fs.unlinkSync(filePath);
            }
            return showError(req, res, error.message, "Error Importing JSON");
        }

        res.render("pages/import-success");
    }
);

app.post("/restore", authenticateToken, adminAuth, (req, res) => {
    DBMan.restoreLatestBackup(DBMan.personnel);
    DBMan.restoreLatestBackup(DBMan.projects);
    res.redirect("/");
});

// 404 Error Handler; anyone who gets this far is not welcome
app.use((req, res) => {
    res.status(404).render("pages/404");
});
