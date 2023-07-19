/**
 * Manages the personnel and projects collections in a database.
 * Gonzales' code
 */
const crypto = require("crypto");
class DBManager {
    /**
     * Constructs a new DBManager instance.
     * @param {Collection} projects - The projects collection object.
     * @param {Collection} personnel - The personnel collection object.
     */
    constructor(projects, personnel) {
        this.personnel = personnel;
        this.projects = projects;
    }

    /**
     * "Unjoins" a person and project
     * @param {string} projectID - The ID of the project to join.
     * @param {string} personID - The ID of the person to join.
     * @returns {Promise<void>} - A promise that resolves once the operation is complete.
     */

    async  unjoin(projectID, personID) {
    let projectQuery = { _id: projectID };
    let personQuery = { _id: personID };

    let person, project;
    try {
        person = await this.personnel.findOne(personQuery);
        project = await this.projects.findOne(projectQuery);

        if (!person || !project) {
            console.log("Result not found");
            return;
        }
    } catch (error) {
        console.log("ERROR: " + error);
    }

    let assignments = person.projects;
    let members = project.members;

    if (!assignments || !members) return; // this person has no projects

    // this isn't joined
    if (
        !assignments.find((assignment) => assignment.id === projectID) ||
        !members.find((member) => member.id === personID)
    )
        return;

    assignments = assignments.filter(
        (assignment) => assignment.id !== projectID
    );
    members = members.filter((member) => member.id !== personID);
    console.log(members)

    // Update the person's projects array or remove it if no assignments remain
    if (assignments.length > 0) {
        try {
            await this.personnel.updateOne(personQuery, {
                $set: { projects: assignments },
            });
            await this.projects.updateOne(projectQuery, {
                $set: { members: members },
            });
        } catch (error) {
            console.log("ERROR: " + error);
            return;
        }
    } else {
        try {
            await this.personnel.updateOne(personQuery, {
                $unset: { projects: "" },
            });
            await this.projects.updateOne(projectQuery, {
                $set: { members: members },
            });
        } catch (error) {
            console.log("ERROR: " + error);
            return;
        }
    }

}


    /**
     * Joins a person to a project in the database.
     * @param {string} projectID - The ID of the project to join.
     * @param {string} personID - The ID of the person to join.
     * @returns {Promise<void>} - A promise that resolves once the join operation is complete.
     */
    async join(projectID, personID) {
        // set up the queries
        const projectQuery = { _id: projectID };
        const personQuery = { _id: personID };

        //create and load the person and project objects with queries
        let person, project;
        try {
            person = await this.personnel.findOne(personQuery);
            project = await this.projects.findOne(projectQuery);
            if (!person || !project) {
                console.log("Result not found");
                return;
            }
        } catch (error) {
            console.log("ERROR: " + error);
        }

        // create projects and members if they don't exist
        if (!person.projects) person.projects = [];

        if (!project.members) project.members = [];

        // check if project and member are already joined
        const assignment = person.projects.find(
            (assignment) => assignment.id === projectID
        );
        const member = project.members.find((member) => member.id === personID);

        // if they aren't the same (member and project were improperly joined somehow)
        if ((assignment !== undefined) ^ (member !== undefined)) {
            console.log("Project and member improperly joined (?). Fixing...");
            if (!assignment) {
                const newAssignment = { id: projectID };
                if (member.role)
                    // if, for some bizarre reason, the improper join has a role assigned
                    newAssignment.role = member.role;
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
            // condition met when they are already joined and no change needs to be made
            return;
        }

        // finally, push to the database, updating only the projects and members arrays
        try {
            await this.personnel.updateOne(personQuery, {
                $set: { projects: person.projects },
            });
            await this.projects.updateOne(projectQuery, {
                $set: { members: project.members },
            });
        } catch (error) {
            console.log("ERROR: " + error);
        }
    }

    /**
     * Changes the role of a person in a project by updating the person and project documents.
     * @param {string} projectID - The ID of the project where the role change occurs.
     * @param {string} personID - The ID of the person whose role is being changed.
     * @param {string} role - The new role to assign to the person.
     * @returns {Promise<void>} - A promise that resolves once the role change operation is complete.
     */
    async changeRole(projectID, personID, role) {
        const projectQuery = { _id: projectID };
        const personQuery = { _id: personID };

        // need to check if the person is in the project, if they aren't call the join function
        this.join(projectID, personID)

        //create and load the person and project objects with queries
        let person, project;
        try {
            person = await this.personnel.findOne(personQuery);
            project = await this.projects.findOne(projectQuery);
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
            const memberIndex = members.findIndex(
            (member) => member.id === personID
        );

        // Check if assignment and member were found
        if (assignmentIndex === -1 || memberIndex === -1) {
            return;
        }

        // Update the role
        assignments[assignmentIndex].role = role;
        members[memberIndex].role = role;

        // push to database
        try {
            await this.personnel.updateOne(personQuery, {
                $set: { projects: assignments },
            });
            await this.projects.updateOne(projectQuery, {
                $set: { members: members },
            });
        } catch (error) {
            console.log("ERROR: " + error);
        }
    }

    /**
     * Creates a new person document into the personnel collection
     * @param {string} person - The new person object to be inserted
     * @returns {Promise<void>} - A promise that resolves once the creation operation is complete.
     */
    async createPerson(person) {
        //generate new ID and insert into db
        person._id = crypto.randomUUID();
        this.personnel.insertOne(person, (err, result) => {
            if (err) {
                console.error("Failed to insert person:", err);
            }
        });
        return person._id;
    }

    /**
     * Creates a new project document into the projects collection
     * @param {string} project - The new project object to be inserted
     * @returns {Promise<void>} - A promise that resolves once the creation operation is complete.
     */
    async createProject(project) {
        //generate new ID and insert into db
        project._id = crypto.randomUUID();
        this.projects.insertOne(project, (err, result) => {
            if (err) {
                console.error("Failed to insert person:", err);
            }
        });
        return project._id;
    }

    /**
     * Deletes a person document from the personnel collection with the specified personID.
     * @param {string} personID - The ID of the person document to be deleted.
     * @returns {Promise<void>} - A promise that resolves once the deletion operation is complete.
     */
    async deletePerson(personID) {
        const personQuery = { _id: personID };

        let person;
        try {
            person = await this.personnel.findOne(personQuery);
            if (!person) {
                console.log("Result not found");
                return;
            }
        } catch (error) {
            console.log("ERROR: " + error);
        }

        // get rid of all joins
        if (person.projects) {
            for (let assignment of person.projects) {
                await this.unjoin(assignment.id, personID);
            }
        }

        this.personnel.deleteOne(personQuery, (err, result) => {
            if (err) {
                console.error("Failed to delete person: ", err);
            }
        });
    }

    /**
     * Deletes a project document from the projects collection with the specified projectID.
     * @param {string} projectID - The ID of the project document to be deleted.
     * @returns {Promise<void>} - A promise that resolves once the deletion operation is complete.
     */
    async deleteProject(projectID) {
        const projectQuery = { _id: projectID };

        let project;
        try {
            project = await this.projects.findOne(projectQuery);
            if (!project) {
                console.log("Result not found");
                return;
            }
        } catch (error) {
            console.log("ERROR: " + error);
        }

        // get rid of all joins
        for (let member of project.members) {
            await this.unjoin(projectID, member.id);
        }

        this.projects.deleteOne(projectQuery, (err, result) => {
            if (err) {
                console.error("Failed to delete project: ", err);
            }
        });
    }

    /**
     * Updates a person document in the personnel collection with the specified personID.
     * @param {string} personID - The ID of the person document to be updated.
     * @param {Object} person - The updated person object containing the new values for firstName and lastName properties.
     * @returns {Promise<void>} - A promise that resolves once the update operation is complete.
     */
    async updatePerson(personID, person) {
        const personQuery = { _id: personID };
        let { firstName, lastName } = person;

        this.personnel.updateOne(personQuery, {
            $set: { firstName, lastName },
        });
    }

    /**
     * Updates a project document in the projects collection with the specified projectID.
     * @param {string} projectID - The ID of the project document to be updated.
     * @param {Object} project - The updated project object containing the new values for name and description properties.
     * @returns {Promise<void>} - A promise that resolves once the update operation is complete.
     */
    async updateProject(projectID, project) {
        const projectQuery = { _id: projectID };
        let { name, description } = project;

        this.projects.updateOne(projectQuery, { $set: { name, description } });
    }
}

module.exports = DBManager;
