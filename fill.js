const { MongoClient } = require("mongodb");
const prompt = require("prompt-sync")({ sigint: true });
const crypto = require("crypto")

const uri = "mongodb://localhost:27017";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri);

// Connect to the MongoDB server
async function connect() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}
connect();

class Person {
    static people = [];
    constructor(firstName, lastName) {
        this._id = crypto.randomUUID();
        this.firstName = firstName;
        this.lastName = lastName;
        this.projects = [];
        this.account = {};
        Person.people.push(this);
    }

    addAccount(username, password, admin = false) {
        this.account = {
            username,
            password,
            admin,
        };
    }

    format() {
        return {
            _id: this._id,
            firstName: this.firstName,
            lastName: this.lastName,
            projects: this.projects,
            account: this.account,
        };
    }

    addProject(project, value) {
        this.projects.push({ id: project._id, value });
    }
}

class Project {
    static projects = [];
    constructor(name, description) {
        this._id = crypto.randomUUID();
        this.name = name;
        this.description = description;
        this.members = [];
        Project.projects.push(this);
    }

    addMember(member, value) {
        this.members.push({ id: member._id, value });
    }

    format() {
        return {
            _id: this._id,
            name: this.name,
            description: this.description,
            members: this.members,
        };
    }
}

function join(project, member, value) {
    project.addMember(member, value);
    member.addProject(project, value);
}

//useful code

const db = client.db("CBProjects");

let quit = false;

while (quit == false) {
    let choice = prompt(
        "Add (1) Personnel (2) Projects (3) person to project (a) account (p) print all stuff | (e) to exit\n"
    );

    switch (choice) {
        case "e":
            quit = true;
            break;
        case "1":
            let firstName = prompt("What fname?\n");
            let lastName = prompt("what lname?\n");
            new Person(firstName, lastName);
            console.log("Dude added")
            break;
        case "2":
            let name = prompt("what name?\n");
            let description = prompt("what desc?");
            new Project(name, description);
            console.log("project added");
            break;
        default:
            console.log("wuh?");
            break;
    }
}

throw new Error();
