const express = require("express");
const app = express();
const { MongoClient } = require("mongodb");
const path = require("path");

const port = 8080;
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

//useful code

const db = client.db("cb-projects");

class Person {
    static people = [];
    static collection = db.collection("personnel");

    constructor(firstname, lastname, projects = [], teams = [], id) {
        this.firstname = firstname;
        this.lastname = lastname;
        this.projects = projects;
        this.teams = teams;
        this.id = id;

        this.addToDatabase();
    }

    async addToDatabase() {
        let inserted = await Person.collection.insertOne(this.format());
        this.id = inserted.insertedId;
        Person.people.push(this);
    }

    static async importAll() {
        const documents = await this.collection.find().toArray();

        documents.forEach((doc) => {
            let person = new Person(doc.firstname, doc.lastname);
            let projects = doc.projects.map((projectId) => {
                return Project.projects.find(
                    (project) => project.id === projectId
                );
            });
            let teams = doc.teams;
            let id = doc._id;
        });
    }

    async update() {
        if (this.id) {
            await Person.collection.replaceOne({ _id: this.id }, this.format());
        }
    }

    static async updateAll() {
        for (let person of Person.people) {
            await person.update();
        }
    }

    format() {
        return {
            firstname: this.firstname,
            lastname: this.lastname,
            projects: this.projects.map((project) => project.id),
            teams: this.teams.map((team) => team.id),
        };
    }

    addProject(project) {
        this.projects.push(project);
    }
}

class Project {
    static projects = [];
    static collection = db.collection("projects");

    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.id;

        Project.projects.push(this);
    }

    static async importAll() {
        const documents = await this.collection.find().toArray();

        documents.forEach((doc) => {
            let project = new Project(doc.name, doc.description);
            project.projects = doc.projects;
            project.teams = doc.teams;
            project.id = doc._id;
        });
    }

    static async pushAll() {
        for (let project of Project.projects) {
            if (!project.id) {
                let inserted = await this.collection.insertOne(
                    project.format()
                );
                project.id = inserted.insertedId;
            } else {
                await this.collection.replaceOne(
                    { _id: project.id },
                    project.format()
                );
            }
        }
    }

    format() {
        return {
            name: this.name,
            description: this.description,
        };
    }
}

async function fillData() {
    Person.importAll();
    Project.importAll();

    let ladder = new Project("Stepladder", "Become a human stepladder");
    let cannon = new Project(
        "Project X",
        "Get launched out of a cannon to please NCOs"
    );

    let shaggy = new Person("Norville", "Rogers");
    let sausage = new Person("Jimmy", "Dean");

    shaggy.addProject(ladder);
    sausage.addProject(cannon);

    // await Person.pushAll();
    // await Project.pushAll();
}

fillData();

/* 
-------------------------------------------------
|                express stuff                  |
-------------------------------------------------
*/

//set views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.get("/", (req, res) => {
    // Pass the 'people' array to the 'people.ejs' template
    res.render("db", { people: Person.people });
    res.send(Person.format());
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
