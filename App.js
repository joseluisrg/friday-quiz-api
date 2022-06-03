const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
const { send } = require('express/lib/response');
//const {MongoClient} = require('mongodb');


const app = express()
const port = 3001

//const mongouri = "mongodb://localhost:27017";

//const mclient = new MongoClient(uri);


// Where we will keep questions and results
let questions = [
    {"id":"1","title":"Sobre la creación de Open Shift", "text":"¿Cuándo fue creado Open Shift?","questionTimeSecs":10, "options":[
        { id: 'q1o1', text: 'Esta es una opción P1A' },
        { id: 'q1o2', text: 'Esta es una opción P1B' },
        { id: 'q1o3', text: 'Esta es una opción P1C' },
      ]},
    {"id":"2","title":"Qué es un operador", "text":"Qué es un operador","questionTimeSecs":5,"options":[
        { id: 'q1o1', text: 'Esta es una opción P2A' },
        { id: 'q1o2', text: 'Esta es una opción P2B' },
        { id: 'q1o3', text: 'Esta es una opción P2C' },
      ]}/*,
    {"id":"3","title":"Qué es CoreOS", "text":"Qué es CoreOS","questionTimeSecs":10,"options":[
        { id: 'q1o1', text: 'Esta es una opción P3A' },
        { id: 'q1o2', text: 'Esta es una opción P3B' },
        { id: 'q1o3', text: 'Esta es una opción P3C' },
      ]},
    {"id":"4","title":"Qué es Knative", "text":"Qué es Knative","questionTimeSecs":10,"options":[
        { id: 'q1o1', text: 'Esta es una opción P4A' },
        { id: 'q1o2', text: 'Esta es una opción P4B' },
        { id: 'q1o3', text: 'Esta es una opción P4C' },
      ]},
    {"id":"5","title":"Que es etcd", "text":"Que es etcd","questionTimeSecs":10,"options":[
        { id: 'q1o1', text: 'Esta es una opción P5A' },
        { id: 'q1o2', text: 'Esta es una opción P5B' },
        { id: 'q1o3', text: 'Esta es una opción P5C' },
      ]}*/
];
let results = []
let status = "standby";

//Store the answer
async function addAnswer(client, answer){
    const result = await client.db("friday-quizes").collection("answers").insertOne(answer);
    console.log(`added answer: ${result.insertedId}`);
}

//0 is the get ready status 
let send_index = 0

app.use(cors());

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//////////// CLIENT CALLS  //////////////////
app.get('/question/poll', (req, res) => {
    console.log('[GET] /question/poll Start');
    if(status == "standby"){
        console.debug("standby")
        res.send({'status': 'standby'})
    } else if (status == "started") {
        console.log("startedj")
        res.send({'status':'started', 'question' : questions[send_index]});
    } else if(status == "finished"){
        console.log("finished")
        res.send({'status':'finished', 'question' : questions[send_index]});
    }
    console.log('[GET] /question/poll End');
});

app.get('/question', (req, res) => {
    console.log('[GET] /question Start');
    res.send(questions)
    console.log('[GET] /question End');
});

app.post('/answer', (req, res) => {
    console.log('[POST] /answer Start');
    console.log(req.body)
    /* try {
        await addAnswer(mclient,req.body);
    } catch (e) {
        console.error(e);
    } */
    res.send({'status':'received'})
    console.log('[POST] /answer End');
});


//////////// ADMIN CALLS  //////////////////

app.get('/quiz/begin', (req, res) => {
    console.log('[GET] /quiz/begin Start');
    status = "started"
    send_index = 0;
    res.send({"status":"started",'question' : questions[send_index]})
    console.log('[GET] /quiz/begin End');
});

app.get('/quiz/restart', (req, res) => {
    console.log('[GET] /quiz/restart Start');
    status = "standby";
    send_index = 0
    res.send({"status":"standby"})
    console.log('[GET] /quiz/restart End');
});

app.get('/question/next', (req, res) => {
    console.log('[GET] /question/next Start');
    if((status == "started") && (send_index >= (questions.length-1))){
        status = "finished"
        res.send("{'status': 'finished', 'current_question':"+send_index+"}")
    } else if (status == "started") {
        send_index++;
        console.log("Question " + send_index + " pushed")
        res.send("{'status': 'started', 'current_question_index':"+send_index+"}")
    } else {
        res.send("{'status': 'standby'}")
    }
    
    console.log('[GET] /question/push End');
});

app.listen(port, () => console.log(`Quiz API listening on ${port}`))
