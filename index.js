const axios = require('axios')
const cheerio = require('cheerio')
const config = require('./config.json')

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

async function findNextMatches() {
    let calendars = await scrapeMatches()

    let nextMatches = []

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

    return nextMatches
}

async function createTable() {
    let nextMatches = await findNextMatches()

    let table = "<table class=\"table-auto mx-auto\">" +
                    "<thead>" +
                        "<tr>" +
                            "<th>Serie</th>" +
                            "<th>Di casa</th>" +
                            "<th>Ospiti</th>" +
                            "<th>Data e ora</th>" +
                        "</tr>" +
                        "</thead>" +
                    "<tbody>"
        

    for (let i = 0; i < nextMatches.length; i++) {
        let nextMatch = nextMatches[i]["nextMatch"]

        table += "<tr>"
        
        // League
        table += "<td>" + nextMatches[i]['league'] + "</td>"

        // Home Squad
        if(nextMatch["homeSquad"] === nextMatches[i]["name"]) {
            table += "<td><span class=\"font-medium\">" + nextMatches[i]['displayName'] + "</span></td>"
        } else {
            table += "<td>" + nextMatch["homeSquad"] + "</td>"
        }

        // Guest Squad
        if(nextMatch["guestSquad"] === nextMatches[i]["name"]) {
            table += "<td><span class=\"font-medium\">" + nextMatches[i]['displayName'] + "</span></td>"
        } else {
            table += "<td>" + nextMatch["guestSquad"] + "</td>"
        }

        // Date Time
        table += "<td>" + nextMatch["date"].substring(0, nextMatch["date"].length - 5) + " - " + nextMatch["time"] + "</td>"

        table += "</tr>"
    }

    table += "</tbody></table>"

    console.log(table)
}

createTable()