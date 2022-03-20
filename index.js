const express = require("express")
const axios = require('axios')
const cheerio = require('cheerio')
const config = require('./config.json')

let nextMatches = []

function flipDayMonth(dateString) {
    let parts = dateString.split("/")
    return parts[1] + "/" + parts[0] + "/" + parts[2]
}

async function scrapeMatches() {
    calendars = []

    // Scrape all matches for each squad
    for (const squad of config.squads) {
        const response = await axios.get(squad.calendar)
        
        if(response.status !== 200)
            continue

        const $ = cheerio.load(response.data)

        // Variable to hold scraped matches for this squad
        let matches = []

        // Each weekend
        let weekendElements = $('table:not(:first-child)')

        for(const weekendElement of weekendElements) {

            // Each matchup
            let matchupElements = $('tr:not(:first-child):not(:nth-child(2)):not(:last-child)', weekendElement)
            
            for (const matchupElement of matchupElements) {
                
                let [
                    firstRoundDate,
                    firstRoundTime,
                    firstRoundResult,
                    firstRoundHomeSquad,
                    secondRoundHomeSquad,
                    secondRoundResult,
                    secondRoundTime,
                    secondRoundDate
                ] = $('td', matchupElement).get().map(function(td) {
                    return $(td).text()
                })

                if(firstRoundHomeSquad === squad.name || secondRoundHomeSquad === squad.name) {
                    // One of our squads is in this matchup
                    matches.push({
                        "homeSquad": firstRoundHomeSquad,
                        "guestSquad": secondRoundHomeSquad,
                        "home": firstRoundHomeSquad === squad.name ? true : false,
                        "date": firstRoundDate,
                        "time": firstRoundTime,
                        "result": firstRoundResult
                    }, {
                        "homeSquad": secondRoundHomeSquad,
                        "guestSquad": firstRoundHomeSquad,
                        "home": secondRoundHomeSquad === squad.name ? true : false,
                        "date": secondRoundDate,
                        "time": secondRoundTime,
                        "result": secondRoundResult
                    })
                }
            }

        }

        matches.sort((a,b) => {
            return Date.parse(flipDayMonth(a.date)) > Date.parse(flipDayMonth(b.date)) ? 1 : -1
        })

        calendars.push({
            "name": squad.name,
            "displayName": squad.displayName,
            "league": squad.league,
            "matches": matches
        })
    }

    return calendars
}

async function updateNextMatches() {
    let calendars = await scrapeMatches()

    if(calendars.length > 0)
        nextMatches = []

    let today = new Date().getTime()

    for(const squad of calendars) {

        let current = squad.matches[0]
        let next = squad.matches[1]
        let len = squad.matches.length

        for(let i = 0; i < len; i++) {
            current = squad.matches[i]
            next = squad.matches[(i+1)%len]

            if (today > Date.parse(flipDayMonth(current.date)) && today <= Date.parse(flipDayMonth(next.date)))
                break
        }

        nextMatches.push({
            "name": squad.name,
            "displayName": squad.displayName,
            "league": squad.league,
            "nextMatch": next
        })
    }

}

// Update matches every hour
var intervalId = setInterval(() => {
    updateNextMatches()
}, 3600)

// Simple API
let app = express()

app.use(function (req, res, next) {
    const corsWhitelist = [
        "http://localhost:8000",
        "https://ttferrara.it"
    ]

    if(corsWhitelist.indexOf(req.headers.origin) !== -1) {
        res.header("Access-Control-Allow-Origin", req.headers.origin)
        res.header("Access-Control-Allow-Methods", "GET")
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    }

    next()
})

app.listen(3000)

app.get("/next-matches", (req, res, next) => {
    res.json(nextMatches)
})