const express = require('express')
const {open} = require('sqlite')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const sqlite3 = require('sqlite3')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const app = express()
app.use(express.json())
let db = null

const initialisedbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB server error:${e.message}`)
    process.exit(1)
  }
}

initialisedbServer()

//Authentication
const authenticateToken = async (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.send(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

const dbObjectToResponseObject = dbobject => {
  return {
    stateId: dbobject.state_id,
    stateName: dbobject.state_name,
    population: dbobject.population,
  }
}

const dbObjectToResponseObject1 = dbobject => {
  return {
    districtId: dbobject.district_id,
    districtName: dbobject.district_name,
    stateId: dbobject.state_id,
    cases: dbobject.cases,
    cured: dbobject.cured,
    active: dbobject.active,
    deaths: dbobject.deaths,
  }
}
//POST API logins the user
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    console.log(isPasswordMatched)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//Get API returns all the list of states
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
  SELECT * FROM 
  state`
  const dbresponse = await db.all(getStatesQuery)
  response.send(
    dbresponse.map(eachelement => dbObjectToResponseObject(eachelement)),
  )
})

//GET API returns the the specific state

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStatesQuery = `
  SELECT * FROM 
  state
  WHERE state_id = ${stateId};`
  const dbresponse = await db.get(getStatesQuery)
  response.send(dbObjectToResponseObject(dbresponse))
})

//POST API inserts the specific district  in a district table
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const getDistrictQuery = `
  INSERT INTO 
  district(district_name,state_id,cases,cured,active,deaths)
  VALUES('${districtName}',
   ${stateId},
   ${cases},
   ${cured},
   ${active},
   ${deaths});`
  const dbResponse = await db.run(getDistrictQuery)
  response.send('District Successfully Added')
})

//GET API returns the specific district
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getSelectQuery = `
  SELECT *
  FROM 
  district
  WHERE district_id = ${districtId};`
    const dbresponse = await db.get(getSelectQuery)
    response.send(dbObjectToResponseObject1(dbresponse))
  },
)

//DELETE API deletes the district

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getSelectQuery = `
  SELECT *
  FROM 
  district
  WHERE district_id = ${districtId};`
    const dbResponse = await db.run(getSelectQuery)
    response.send('District Removed')
  },
)

//PUT API updates the district
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateSelectQuery = `
  UPDATE 
   district
  SET
   district_name = '${districtName}',
   state_id = ${stateId},
   cases =  ${cases},
   cured = ${cured},
   active = ${active},
   deaths = ${deaths}
  WHERE district_id = ${districtId};`
    const dbResponse = await db.run(updateSelectQuery)
    response.send('District Details Updated')
  },
)

//GET API of the cases of the specific state
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getSelectStatsQuery = `
  SELECT 
  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths)
  FROM 
  district
  WHERE state_id = ${stateId}
  ;`
    const stats = await db.get(getSelectStatsQuery)
    console.log(stats)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)

module.exports = app
