"use strict";

require("dotenv").config();
const http = require("http");
const url = require("url");
const cp = require("child_process");
const facts = require("./facts.js");

http.createServer(async (req, res) => {

  let parsed = url.parse(req.url, true);
	let query = parsed.query;
  let authorized = query.auth == process.env.AUTHTOKEN;
	let now = Date.now();
  if (parsed.pathname == "/") {
    res.writeHead(301, {Location: "/generate"});
    res.end();
  } else if (parsed.pathname == "/generate") {
    res.writeHead(200, {"Content-Type": "application/json"});
    if (query.includes === undefined)
    	res.end(JSON.stringify({fact: await facts.genFact(), found: true, duration: (Date.now() - now), tries: 1}));
  	else {
  		let child = cp.fork("./find.js");
  		child.on("message", fact => {
  			res.end(JSON.stringify({fact: fact.text, found: fact.found, duration: (Date.now() - now), tries: fact.tries}));
  			child.kill();
  		});
  		child.on("close", () => {
  			console.log("Find child killed");
  		});
  		child.send(query.includes);
  	}
  } else if (parsed.pathname == "/database") {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify(await facts.fetchDatabase()));
  } else if (parsed.pathname == "/bulk") {
    res.writeHead(200, {"Content-Type": "application/json"});
    if (query.nb === undefined) query.nb = 100;
    let child = cp.fork("./bulk.js");
    child.on("message", bulk => {
      res.end(JSON.stringify(bulk));
      child.kill();
    });
    child.on("close", () => {
      console.log("Bulk child killed");
    });
    child.send(query.nb);
  } else if (parsed.pathname == "/insert") {
    if (authorized && query.name !== undefined && query.string !== undefined) {
      let database = await facts.fetchDatabase();
      while (query.string.includes("_"))
        query.string = query.string.replace("_", " ");
      if (!database.some(cat => cat.name == query.name))
        database.push({name: query.name, strings: []});
      database.forEach(cat => {
        if (cat.name == query.name) cat.strings.push(query.string);
      });
      facts.provideDatabase(database);
    }
    res.writeHead(301, {Location: "/database"});
    res.end();
  }
}).listen(process.env.PORT);

console.log("Web server ready!");
