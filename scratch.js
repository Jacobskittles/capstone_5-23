// just for testing

var project1 = {
    firstName: "billy",
    lastName: "bobby",
    thing: [9, 6, 2],
};

var project2 = {
    firstName: "a",
    lastName: "b",
    weight: 7,
};

var projects = [project1, project2];

for (project of projects) {
    if (project.weight == 6) {
        console.log(project.weight);
    } else if (project.thing[1] == 6) {
        console.log("ahahah");
    } else {
        console.log(project);
    }
}
