const { MongoClient } = require("mongodb");
const prompt = require("prompt-sync")({ sigint: true });
const crypto = require("crypto");
require('dotenv').config();

const API_KEY = process.env.OPENAI_API_KEY;

const uri = "mongodb://10.10.20.64:27017";

const apiUrl = "https://api.openai.com/v1/chat/completions";

const chatgptString = `I want you to generate as a json file nothing more, a list of people like this, but come up with new names and projects and passwords and more people and projects, don't put it in a code block, don't put anything other than raw json, also make sure some people aren't assigned to projects:

{
    "people": [
        {
            "id": 0,
            "firstname": "Norville",
            "lastname": "Rogers",
            "username": "zoiksScoob45",
            "password": "password"
        },
        {
            "id": 1,
            "firstname": "Jimmy",
            "lastname": "Dean",
            "username": "sausageDude",
            "password": "pass123"
        }
    ],
    "projects": [
        {
            "name": "Human Stepladder",
            "description": "Become a stepladder for the good of America and because we told you to.",
            "members": [
                [0, 2], // first number is id of member, second number is 1 or 2 never 0
                [1, 1]
            ]
        }
    ]
}`;

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

    addProject(project, role=null, weight=null) {
        let projectObj = { id: project._id };

        if (role !== null) {
            projectObj.role = role;
        }

        if (weight !== null) {
            projectObj.weight = weight;
        }

        this.projects.push(projectObj);
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

    addMember(member, role = null, weight = null) {
        let memberObj = { id: member._id };

        if (role !== null) {
            memberObj.role = role;
        }

        if (weight !== null) {
            memberObj
        }
        this.members.push({ id: member._id, weight });
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

function join(project, member, weight) {
    project.addMember(member, weight);
    member.addProject(project, weight);
}

//useful code

const db = client.db("CBProjects");

const personnel = db.collection("personnel");

const projects = db.collection("projects");

let quit = false;

async function insertAll() {
    console.log("okay I'll try");
    try {
        for (person of Person.people) {
            await personnel.insertOne(person.format());
        }
        for (project of Project.projects) {
            await projects.insertOne(project.format());
        }
    } catch {
        console.log("Fuck! I fucked up!");
        return;
    }

    console.log("alr cool im done");
}

async function callChatGPT(prompt) {
    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization:
                "Bearer " + API_KEY,
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: prompt,
                },
            ],
        }),
    });

    const data = await response.json();
    console.log(data.choices[0].message.content)
    return JSON.parse(data.choices[0].message.content);
}

async function main() {
    while (quit == false) {
        let choice = prompt(
            "Add (1) Personnel (2) Projects (3) person to project (a) account (p) print all stuff (e) export | (q) to exit\n"
        );

        if (choice === "q") {
            quit = true;
        } else if (choice === "1") {
            let firstName = prompt("What fname?\n");
            let lastName = prompt("what lname?\n");
            console.log(firstName + " " + lastName);
            new Person(firstName, lastName);
            console.log("Dude added");
        } else if (choice === "2") {
            let name = prompt("what name?\n");
            let description = prompt("what desc?");
            new Project(name, description);
            console.log("project added");
        } else if (choice === "3") {
            console.log("select a dude:");
            for (let [i, person] of Person.people.entries()) {
                console.log(
                    i + ": " + person.firstName + " " + person.lastName
                );
            }
            let person = Person.people[parseInt(prompt())];
            console.log("select a project:");
            for (let [i, project] of Project.projects.entries()) {
                console.log(
                    i + ": " + project.name + " " + project.description
                );
            }
            let project = Project.projects[parseInt(prompt())];
            let value = prompt("are they a leader?") == "y" ? 2 : 1;

            join(project, person, value);
        } else if (choice === "a") {
            console.log("select a dude:");
            for (let [i, person] of Person.people.entries()) {
                console.log(
                    i + ": " + person.firstName + " " + person.lastName
                );
            }
            let person = Person.people[parseInt(prompt())];
            let username = prompt("What the username be?");
            let password = prompt("password?");
            let admin = prompt("are they an admin?") == "y";
            person.addAccount(username, password, admin);
        } else if (choice === "p") {
            for (let person of Person.people) {
                console.log(JSON.stringify(person));
            }
            for (let project of Project.projects) {
                console.log(JSON.stringify(project));
            }
        } else if (choice === "e") {
            await insertAll();
        } else if (choice === "i") {
            try {
                let response = await callChatGPT(chatgptString);
                console.log(response);
                let dudes = [];
                for (let person of response.people) {
                    let dude = new Person(person.firstname, person.lastname);
                    dude.addAccount(person.username, person.password, false);
                    dudes.push(dude);
                }
                for (let project of response.projects) {
                    let proj = new Project(project.name, project.description);
                    for (member of project.members) {
                        join(proj, dudes[member[0]], member[1]);
                    }
                }
            } catch (error) {
                console.log("oops!" + error.constructor.name);
            }
        } else {
            console.log("wuh?");
        }
    }

    throw new Error();
}

main();
