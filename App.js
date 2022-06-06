require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser');
const cors = require('cors');
const { send } = require('express/lib/response');
const {MongoClient} = require('mongodb');


const NODE_PORT = process.env.NODE_PORT;
const TOP_NUMBER = parseInt(process.env.TOP_NUMBER);
const MONGO_URI = process.env.MONGO_URI;
const DATABASE_NAME = process.env.DATABASE_NAME;
const ANSWERS_COLLECTION_NAME = process.env.ANSWERS_COLLECTION_NAME;
const QUESTIONS_COLLECTION_NAME = process.env.QUESTIONS_COLLECTION_NAME;
const CONNECT_TIMEOUT = parseInt(process.env.CONNECT_TIMEOUT);

const app = express()
const mongoOptions = {
    connectTimeoutMS: CONNECT_TIMEOUT,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };



let database
let answersCollection
let questionsCollection
let mClient = null;


// Where we will keep questions and results
let questionsCacheAnswered = new Map();
let questionsCache = []
/*[
    {"id":"1","title":"Sobre la creación de Open Shift", "text":"¿Cuándo fue creado Open Shift?","questionTimeSecs":10,
        "enabled": true, "options":[
        { id: 'q1o1', text: 'Esta es una opción P1A' },
        { id: 'q1o2', text: 'Esta es una opción P1B' },
        { id: 'q1o3', text: 'Esta es una opción P1C' },
      ]},
    {"id":"2","title":"Qué es un operador", "text":"Qué es un operador","questionTimeSecs":5, "enabled": true, "options":[
        { id: 'q1o1', text: 'Esta es una opción P2A' },
        { id: 'q1o2', text: 'Esta es una opción P2B' },
        { id: 'q1o3', text: 'Esta es una opción P2C' },
      ]},
    {"id":"3","title":"Qué es CoreOS", "text":"Qué es CoreOS","questionTimeSecs":10,"enabled": false, "options":[
        { id: 'q1o1', text: 'Esta es una opción P3A' },
        { id: 'q1o2', text: 'Esta es una opción P3B' },
        { id: 'q1o3', text: 'Esta es una opción P3C' },
      ]},
    {"id":"4","title":"Qué es Knative", "text":"Qué es Knative","questionTimeSecs":10, "enabled": false, "options":[
        { id: 'q1o1', text: 'Esta es una opción P4A' },
        { id: 'q1o2', text: 'Esta es una opción P4B' },
        { id: 'q1o3', text: 'Esta es una opción P4C' },
      ]},
    {"id":"5","title":"Que es etcd", "text":"Que es etcd","questionTimeSecs":10, "enabled": false, "options":[
        { id: 'q1o1', text: 'Esta es una opción P5A' },
        { id: 'q1o2', text: 'Esta es una opción P5B' },
        { id: 'q1o3', text: 'Esta es una opción P5C' },
      ]}*/
; 
let results = []
let status = "standby";
let questionCode
let topAnswers;
////////////// Utils ////////////////

function getCodeSum(answerArray){
    let sum = 0
    answerArray.forEach(answerItem => {
        if((questionsCacheAnswered.get(answerItem.questionId).correctIndex == answerItem.optionSelected) &&
        answerItem.answered
        ) {
            sum = sum + answerItem.answerCode
        }
    });
    return sum;
}

function setQuestions(newQuestions, newQuestionsAnswered){
    questionsCache = newQuestions;
    questionsCacheAnswered = newQuestionsAnswered;
    console.log(`${questionsCache.length} Questions loaded: ${JSON.stringify(questionsCache)}`);
    console.log(`${questionsCacheAnswered.size} Questions Answered loaded.`);
}

///////////// DATABASE FUNCTIONS ///////////
async function connectDatabase(){
    try {
        mClient = new MongoClient(MONGO_URI,mongoOptions);
        await mClient.connect();
        database = mClient.db(DATABASE_NAME);
        answersCollection = database.collection(ANSWERS_COLLECTION_NAME)
        questionsCollection = database.collection(QUESTIONS_COLLECTION_NAME)
        console.info(`Database connection successful with client ${mClient} and collections: ${answersCollection} and ${questionsCollection}` );
        getQuestions();
    } catch (e) {
        console.error("Error connecting to database.")
        console.error(e)
    }
}

async function insertAnswer(answer){
    try {
        const result = answersCollection.insertOne(answer)
        console.log(`An answer was inserted with the _id: ${result.insertedId}`);
    } catch (e) {
        console.error(e)
    }
};


async function getQuestions(){
    questionsLocal = new Array();
    questionsAnswered = new Map();
    try {
        var cursor = questionsCollection.find({});
        await cursor.forEach(questionFound => {
            if (questionFound.enabled) {
                questionsAnswered.set(questionFound.id, questionFound)
                const cleanQuestion = Object.assign({}, questionFound);
                delete cleanQuestion.correctIndex;
                questionsLocal.push(cleanQuestion);
            }
        });
        setQuestions(questionsLocal, questionsAnswered)
    } catch (e) {
        console.error(e)
    }
};

async function getTopAnswers(topNumber){
    try {
        await answersCollection.find({}).sort({"codesum":-1}).limit(topNumber).toArray(
            function(err, result) {
                if (err) throw err;
                console.log(`Top ${topNumber} answers found: ${JSON.stringify(result)}`);
                topAnswers = result;
          });
        } catch (e) {
        console.error(e)
    }
};

//0 is the get ready status 
let send_index = 0

app.use(cors());

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//////////// CLIENT CALLS  //////////////////
app.get('/question/poll', (req, res) => {
    //console.log('[GET] /question/poll Start');
    if(status == "standby"){
        console.debug("standby")
        res.send({'status': 'standby', 'questionCode': 0})
    } else if (status == "started") {
        console.log("started")
        res.send({'status':'started', 'question' : questionsCache[send_index],'questionCode': questionCode});
    } else if(status == "finished"){
        console.log("finished")
        res.send({'status':'finished', 'question' : questionsCache[send_index], 'questionCode': questionCode});
    }
    //console.log('[GET] /question/poll End');
});

app.get('/question', (req, res) => {
    console.log('[GET] /question Start');
    res.send(questionsCache)
    console.log('[GET] /question End');
});

app.post('/answer', (req, res) => {
    console.log('[POST] /answer Start');
    console.log(req.body)
    try {
        answerSubmited = req.body;
        codesum = getCodeSum(answerSubmited.answers)
        answerSubmited.codesum = codesum;
        insertAnswer(req.body);

    } catch (e) {
        console.error(e);
    }
    res.send({'status':'received'})
    console.log('[POST] /answer End');
});


//////////// ADMIN CALLS  //////////////////

app.get('/quiz/begin', (req, res) => {
    console.log('[GET] /quiz/begin Start');
    status = "started";
    questionCode = new Date().getTime()
    send_index = 0;
    sendObj = {"status":"started",'question' : questionsCache[send_index], questionCode: questionCode}
    res.send(sendObj)
    console.log('[GET] /quiz/begin End sending ' + JSON.stringify(sendObj));
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
    if((status == "started") && (send_index >= (questionsCache.length-1))){
        status = "finished"
        res.send("{'status': 'finished', 'current_question':"+send_index+"}")
    } else if (status == "started") {
        send_index++;
        questionCode = new Date().getTime()
        console.log("Question " + send_index + " pushed with code " + questionCode)
        res.send("{'status': 'started', 'current_question_index':"+send_index+"}")
    } else {
        res.send("{'status': 'standby'}")
    }
    
    console.log('[GET] /question/push End');
});

app.get('/top', (req, res) => {
    console.log('[GET] /top Start');
    getTopAnswers(TOP_NUMBER);
    res.send(topAnswers)
    console.log('[GET] /topEnd');
});

connectDatabase();
app.listen(NODE_PORT, () => console.log(`Quiz API listening on ${NODE_PORT}`))
