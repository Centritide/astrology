/**
 * RequireJS configuration
 * 
 */
requirejs.config({
    waitSeconds : 0,
	paths : {
        text: "../libs/text",
        json: "../libs/json",
		jquery: "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.5.1/jquery.min",
		backbone: "https://cdnjs.cloudflare.com/ajax/libs/backbone.js/1.4.0/backbone-min",
		underscore: "https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.13.1/underscore-min",
		twemoji: "https://twemoji.maxcdn.com/v/latest/twemoji.min"
	},
	shim : {
		jquery: {
			exports : "$"
		},
		underscore: {
			exports	: ["_"]
		},
		backbone: {
			deps	: ["underscore", "jquery"],
			exports : "Backbone"
		},
		twemoji: {
			exports: "twemoji"
		}
	}
});
//Start the main app logic.
requirejs(["jquery", "underscore", "backbone", "twemoji", "json!../blaseball/teams.json", "json!../blaseball/weather.json"], function($, _, Backbone, twemoji, teamTypes, weather) {
	var App = {Models: {}, Collections: {}, Views: {}, Router: {}}, activeRouter, activePage = { team: null, season: null, history: false }, activeTeam, activeSeason, navView, teamView, seasonView, detailsView, lightMode = false;
	
	//-- BEGIN ROUTER --
	App.Router = Backbone.Router.extend({
		routes: {
			"": "index",
			":team": "team",
			":team/history": "history",
			":team/season/:season": "season"
		},
		index: loadPage,
		team: loadPage,
		history: loadHistory,
		season: loadPage
	});
	//-- END ROUTER --
	
	//-- BEGIN MODELS --
	App.Models.Nav = Backbone.Model.extend({});
	App.Models.Team = Backbone.Model.extend({
		canonicalName: function() {
			if(!_.isEmpty(this.get("state")) && _.has(this.get("state"), "scattered")) {
				return this.get("state").scattered.fullName;
			}
			return this.get("fullName");
		},
		canonicalNickname: function() {
			if(!_.isEmpty(this.get("state")) && _.has(this.get("state"), "scattered")) {
				return this.get("state").scattered.nickname;
			}
			return this.get("nickname");
		},
		slug: function() {
			if(this.id == "9494152b-99f6-4adb-9573-f9e084bc813f") {
				return "baltimore-clabs";
			}
			return this.canonicalName().toLowerCase().replace(/\&/g, "-and-").replace(/[\,\.\']+/g, "").replace(/[\-\s]+/g, "-");
		},
		type: function() {
			var thisId = this.id;
			return _.findKey(teamTypes, function(ids) { return _.contains(ids, thisId); }) || "unknown";
		},
		players: function(position) {
			var teamPlayers = this.get("players");
			return _.template($("#template-players").html())({
				emoji: parseEmoji,
				position: position, 
				players: teamPlayers ? _.map(this.get(position.toLowerCase()), function(id) {
					return teamPlayers.findWhere({ id: id });
				}) : []
			});
		},
		inactiveSeasons: function() {
			switch(this.id) {
				case "d9f89a8a-c563-493e-9d64-78e4f9a55d4a": // atlantis georgias
				case "bb4a9de5-c924-4923-a0cb-9d1445f1ee5d": // ohio worms
				case "46358869-dce9-4a01-bfba-ac24fc56f57e": // core mechanics
					return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
				case "8d87c468-699a-47a8-b40d-cfb73a5660ad": // baltimore crabs
					return [10, 11];
				case "b47df036-3aa4-4b98-8e9e-fe1d3ff1894b": // oxford paws
				case "2e22beba-8e36-42ba-a8bf-975683c52b5f": // carolina queens
				return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
				default:
					return [];
			}
		},
		emoji: parseEmoji,
		isLightMode: function() {
			return lightMode;
		}
	});
	App.Models.Season = Backbone.Model.extend({});
	App.Models.Game = Backbone.Model.extend({
		oddsAdjective: function() {
			var adjectives = "";
			if(this.get("team").odds > this.get("opponent").odds) {
				if(this.get("team").odds - this.get("opponent").odds > .25) {
					adjectives += "heavily ";
				}
				adjectives += this.get("team").id == "57ec08cc-0411-4643-b304-0e80dbc15ac7" ? "flavored " : "favored ";
			} else {
				if(this.get("opponent").odds - this.get("team").odds > .25) {
					adjectives += "heavy ";
				}
				adjectives += "underdog ";
			}
			return adjectives;
		},
		resultVerb: function() {
			if(this.get("team").isWinner && this.get("isShame")) {
				return (this.get("team").isAway ? "un" : "") + "shamed";
			} else if(this.get("team").isWinner && !this.get("isShame")) {
				return "defeated";
			} else if(!this.get("team").isWinner && this.get("isShame")) {
				return "were " + (this.get("team").isAway ? "" : "un") + "shamed by";
			} else {
				return "lost to";
			}
		},
		formatDuration: function() {
			var duration = "", 
				hours = Math.floor(this.get("duration") / 1000 / 60 / 60), 
				minutes = Math.floor(this.get("duration") / 1000 / 60) % 60,
				seconds = Math.floor(this.get("duration") / 1000) % 60;
			if(hours > 0) {
				if(hours < 10) {
					duration += "0";
				}
				duration += hours + ":";
			}
			if(minutes < 10) {
				duration += "0";
			}
			duration += minutes + ":";
			if(seconds < 10) {
				duration += "0";
			}
			duration += seconds;
			return duration;
		},
		relevantOutcomes: function() {
			var thisModel = this, outcomes = _.clone(this.get("outcomes"));
			
			if(this.get("duration") > 60 * 60 * 1000) {
				if(this.get("season") == 2 && this.get("day") == 72) { // grand unslam
					outcomes.unshift("BRIDGE WEAKENED");
				} else if(this.get("season") == 3 && this.get("day") == 87) { // waveback event
					outcomes.unshift("PLANAR WAVES DETECTED");
				} else if(this.get("season") < 3) { // early games had tons of siestas
					outcomes.unshift("SIESTA DETECTED");
				} else {
					outcomes.unshift("SPILLOVER DETECTED");
				}
			}
			
			return _.chain(outcomes).map(function(outcome) {
				return thisModel.parseOutcome(outcome);
			}).compact().filter(function(outcome) {
				return outcome.teams == undefined || _.contains(outcome.teams, activeTeam.id);
			}).value();
		},
		parseOutcome: function(outcome) {
			var matcher = outcome.match(/^the birds pecked (.+) free!\s?$/i);
			if(matcher) {
				return {
					emoji: 0x1F426,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				};
			}
			matcher = outcome.match(/^the blooddrain gurgled! (.+) siphoned some of (.+)'s (hitting|pitching|baserunning|defensive) ability!$/i);
			if(matcher) {
				return {
					emoji: 0x1FA78,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>"),
					special: "<strong>" + matcher[1] + "</strong> gurgied <strong>" + matcher[2] + "</strong>'s " + matcher[3] + " ability! <em>Fresh blood, here we come!</em>",
					special2: "<strong>" + matcher[1] + "</strong> hungers for blood! <strong>" + matcher[2] + "</strong>'s " + matcher[3] + " ability was siphoned!",
					players: [
						{ name: matcher[1], team: null },
						{ name: matcher[2], team: null }
					],
					gurgie: matcher[3]
				};
			}
			matcher = outcome.match(/^(.+) is partying!(?:\sa flock of birds are attracted to .+!)?$/i);
			if(matcher) {
				return {
					emoji: 0x1F973,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				};
			}
			matcher = outcome.match(/^(.+) became unstable!$/i);
			if(matcher) {
				return {
					emoji: 0x1F635,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				};
			}
			matcher = outcome.match(/^(a debt was collected. )?rogue umpire incinerated (.+) (hitter|pitcher) (.+)! replaced by (.+)$/i);
			if(matcher) {
				var team = getTeamByName(matcher[2]);
				return {
					emoji: matcher[1] ? 0x1F47F : 0x1F525,
					formatted: outcome.replace(matcher[1], "<span style='color:red'>" + matcher[1] + "</span>").replace(matcher[2], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor") + "'>" + team.get("nickname") + "</strong>").replace(matcher[4], "<strong>" + matcher[4] + "</strong>").replace(matcher[5], "<strong>" + matcher[5] + "</strong>"),
					players: [
						{ name: matcher[4], team: team.id },
						{ name: matcher[5], team: team.id }
					],
					teams: [ team.id ],
					position: matcher[3]
				};
			}
			matcher = outcome.match(/^rogue umpire incinerated (.+)!$/i);
			if(matcher) {
				var team = getTeamByName(matcher[1]);
				if(team) {
					return {
						emoji: 0x1F525,
						formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor")+ "'>" + team.get("nickname") + "</strong>").replace(matcher[3], "<strong>" + matcher[3] + "</strong>"),
						teams: [ team.id ]
					};
				} else {
					return {
						emoji: 0x1F525,
						formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
						players: [{ name: matcher[1], team: null }]
					};
				}
			}
			matcher = outcome.match(/^rogue umpire tried to incinerate (.+) (hitter|pitcher) (.+), but they're fireproof! the umpire was incinerated instead!$/i);
			if(matcher) {
				var team = getTeamByName(matcher[1]);
				return {
					emoji: 0x1F9E5,
					formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor")+ "'>" + team.get("nickname") + "</strong>").replace(matcher[3], "<strong>" + matcher[3] + "</strong>"),
					players: [{ name: matcher[3], team: team.id }],
					teams: [ team.id ],
					position: matcher[2]
				};
			}
			matcher = outcome.match(/^(.+) (hitter|pitcher) (.+) swallowed a stray peanut and had an? (.+) reaction!$/i);
			if(matcher) {
				var emoji, team = getTeamByName(matcher[1]);
				if(matcher[4] == "allergic") {
					emoji = 0x1F922;
				} else if(matcher[4] == "yummy") {
					emoji = 0x1F60B;
				} else {
					emoji = 0x2753;
				}
				return {
					emoji: emoji,
					formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor") + "'>" + team.get("nickname") + "</strong>").replace(matcher[3], "<strong>" + matcher[3] + "</strong>").replace(matcher[4], "<em>" + matcher[4] + "</em>"),
					players: [{ name: matcher[3], team: team.id }],
					teams: [ team.id ],
					position: matcher[2],
					reaction: matcher[4]
				}
			}
			matcher = outcome.match(/^(.+) swallowed a stray peanut and had an? (.+) reaction!$/i);
			if(matcher) {
				var emoji;
				if(matcher[2] == "allergic") {
					emoji = 0x1F922;
				} else if(matcher[2] == "yummy") {
					emoji = 0x1F60B;
				} else {
					emoji = 0x2753;
				}
				return {
					emoji: emoji,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<em>" + matcher[2] + "</em>"),
					players: [{ name: matcher[1], team: null }],
					reaction: matcher[2]
				}
			}
			matcher = outcome.match(/^(.+) has been cured of their peanut allergy!$/i);
			if(matcher) {
				return {
					emoji: 0x1F60B,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/^(.+) is no longer superallergic!$/i);
			if(matcher) {
				return {
					emoji: 0x1F60B,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/^the (.+) had (their (lineup|rotation)|several players) shuffled in the reverb!$/i);
			if(matcher) {
				var team = getTeamByName(matcher[1]);
				return {
					emoji: 0x1F30A,
					formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor") + "'>" + team.get("nickname") + "</strong>"),
					teams: [ team.id ],
					position: matcher[3] ? matcher[3] : matcher[2]
				}
			}
			matcher = outcome.match(/^the (.+) were (completely )?shuffled in the reverb!$/i);
			if(matcher) {
				var team = getTeamByName(matcher[1]);
				return {
					emoji: 0x1F30A,
					formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor") + "'>" + team.get("nickname") + "</strong>"),
					teams: [ team.id ],
					position: "all"
				}
			}
			matcher = outcome.match(/^(reverberations are at dangerous levels! )?(.+) is now reverberating wildly!$/i);
			if(matcher) {
				return {
					emoji: 0x1F30A,
					formatted: outcome.replace(matcher[2], "<strong>" + matcher[2] + "</strong>"),
					players: [{ name: matcher[2], team: null }]
				}
			}
			matcher = outcome.match(/^((.+) flickers! )?(.+) and (.+) switched teams in the feedback!$/i);
			if(matcher) {
				return {
					emoji: 0x1F399,
					formatted: outcome.replace(matcher[1], "<span style='color:red'>" + matcher[1] + "</span>").replaceAll(matcher[3], "<strong>" + matcher[3] + "</strong>").replace(matcher[4], "<strong>" + matcher[4] + "</strong>"),
					players: [
						{ name: matcher[3], team: null },
						{ name: matcher[4], team: null }
					]
				}
			}
			matcher = outcome.match(/^reality begins to flicker...but (.+) resists! (.+) is affect by the flicker...$/i);
			if(matcher) {
				return {
					emoji: 0x1F3A7,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>"),
					players: [
						{ name: matcher[1], team: null },
						{ name: matcher[2], team: null }
					]
				}
			}
			matcher = outcome.match(/^(.+) hits (.+) with a pitch! .+ is now (.+)!$/i);
			if(matcher) {
				return {
					emoji: 0x1F974,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replaceAll(matcher[2], "<strong>" + matcher[2] + "</strong>").replace(matcher[3], "<em>" + matcher[3] + "</em>"),
					players: [
						{ name: matcher[1], team: null },
						{ name: matcher[2], team: null }
					],
					status: matcher[3]
				}
			}
			matcher = outcome.match(/^(.+) is now being observed\.(?:\.\.)?$/i);
			if(matcher) {
				return {
					emoji: 0x1F441,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [
						{ name: matcher[1], team: null }
					]
				}
			}
			matcher = outcome.match(/^the instability (?:spreads|chains) to the (.+)'s (.+)!$/i);
			if(matcher) {
				var team = getTeamByName(matcher[1]);
				return {
					emoji: 0x1F517,
					formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor") + "'>" + team.get("nickname") + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>"),
					players: [{ name: matcher[2], team: team.id }],
					teams: [ team.id ]
				}
			}
			matcher = outcome.match(/^your ((overbracket|underbracket|season) \d+) champions are the (.+)!$/i);
			if(matcher) {
				var team = getTeamByName(matcher[3]);
				return {
					emoji: 0x1F48D,
					formatted: outcome.replace(matcher[1], "<strong class='" + matcher[2].toLowerCase() +"'>" + matcher[1] + "</strong>").replace(matcher[3], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor") + "'>" + team.canonicalName() + "</strong>"),
					teams: [ team.id ]
				}
			}
			matcher = outcome.match(/^a big peanut crashes into the field, encasing (.+)!$/i);
			if(matcher) {
				return {
					emoji: 0x1F95C,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/the (.+) accumulate 10\sthe sun collapses\sthe moon is swallowed\sthe black hole forms\ssun 2 rises\sthe black hole swallowed a win from the (.+)!/i);
			if(matcher) {
				var swallower = getTeamByName(matcher[1].substr(0, 1).toUpperCase() + matcher[1].substr(1).toLowerCase()), swallowee = getTeamByName(matcher[2]);
				return {
					emoji: 0x26AB,
					formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + swallower.get("secondaryColor") + "'>" + swallower.get("nickname").toUpperCase() + "</strong>").replace(matcher[2], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + swallowee.get("secondaryColor") + "'>" + swallowee.get("nickname") + "</strong>").replace(/[\r\n]/gm, "<br>"),
					teams: [ swallower.id, swallowee.id ]
				}
			}
			matcher = outcome.match(/the black hole swallowed a win from the (.+)!/i);
			if(matcher) {
				var team = getTeamByName(matcher[1]);
				return {
					emoji: 0x26AB,
					formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor") + "'>" + team.get("nickname") + "</strong>"),
					teams: [ team.id ]
				}
			}
			matcher = outcome.match(/^sun 2 (?:smiled at|set a win upon) the ([^\.]+)\.?$/i);
			if(matcher) {
				var team = getTeamByName(matcher[1]);
				return {
					emoji: 0x2600,
					formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor") + "'>" + team.get("nickname") + "</strong>"),
					teams: [ team.id ]
				}
			}
			matcher = outcome.match(/the black hole burped at the (.+)!/i);
			if(matcher) {
				var team = getTeamByName(matcher[1]);
				return {
					emoji: 0x26AB,
					formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor") + "'>" + team.get("nickname") + "</strong>"),
					teams: [ team.id ]
				}
			}
			matcher = outcome.match(/sun 30 smiled upon the (.+) and (.+)\.$/i);
			if(matcher) {
				var team1 = getTeamByName(matcher[1]), team2 = getTeamByName(matcher[2]);
				return {
					emoji: 0x2600,
					formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team1.get("secondaryColor") + "'>" + team1.get("nickname") + "</strong>").replace(matcher[2], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team2.get("secondaryColor") + "'>" + team2.get("nickname") + "</strong>"),
					teams: [ team1.id, team2.id ]
				}
			}
			matcher = outcome.match(/^(.+) was percolated by the tractor bean!(?: (.+) was fired into outer space!)?$/i);
			if(matcher) {
				return {
					emoji: 0x2615,
					formatted: outcome.replaceAll(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }],
				};
			}
			matcher = outcome.match(/^(.+) tasted the infinite and shelled (.+)!$/i);
			if(matcher) {
				return {
					emoji: 0x1F95C,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>"),
					players: [
						{ name: matcher[1], team: null },
						{ name: matcher[2], team: null }
					]
				}
			}
			matcher = outcome.match(/^(.+) was swept elsewhere!$/i);
			if(matcher) {
				return {
					emoji: 0x1F4A8,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/^(.+) (?:returned|was pulled back) from elsewhere!$/i);
			if(matcher) {
				return {
					emoji: 0x1F9C7,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/^salmon cannons expelled (.+) elsewhere\.$/i)
			if(matcher) {
				return {
					emoji: 0x1F41F,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/(.+) gained (.+)(?: and (?:dropped|ditched) (.+))?\.?/i);
			if(matcher) {
				return {
					emoji: 0x1F381,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/(.+) dropped (.+)\./i);
			if(matcher) {
				return {
					emoji: 0x1F5D1,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }],
					unimportant: true
				}
			}
			matcher = outcome.match(/(.+) stole (.+)!/i);
			if(matcher) {
				return {
					emoji: 0x1F978,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }],
					unimportant: true
				}
			}
			matcher = outcome.match(/(.+)'s? (.+) (?:broke!|was damaged|were damaged\.)/i);
			if(matcher) {
				return {
					emoji: 0x26A0,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }],
					unimportant: true
				}
			}
			matcher = outcome.match(/^(?:trader |traitor )?(.+) traded their .+ for (.+)'s? .+\.$/i);
			if(matcher) {
				return {
					emoji: 0x267B,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>"),
					players: [
						{ name: matcher[1], team: null },
						{ name: matcher[2], team: null }
					],
					unimportant: true
				}
			}
			matcher = outcome.match(/(.+)'s? (.+) was repaired by smithy\./i);
			if(matcher) {
				return {
					emoji: 0x1F528,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }],
					unimportant: true
				}
			}
			matcher = outcome.match(/the salmon swam upstream!\s(.+)'s? (.+) (?:was|were) (?:restored|repaired)(?:!|\.)/i);
			if(matcher) {
				return {
					emoji: 0x1F41F,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }],
					unimportant: true
				}
			}
			matcher = outcome.match(/salmon cannons fire\sconsumer expelled/i);
			if(matcher) {
				return {
					emoji: 0x1F41F,
					formatted: outcome,
					unimportant: true
				}
			}
			matcher = outcome.match(/consumers attack\s(?:scattered\s)?(.+) defends\s+(.+) (?:damaged|breaks?)/i);
			if(matcher) {
				return {
					emoji: 0x1F988,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }],
					unimportant: true
				}
			}
			matcher = outcome.match(/.+!\s(liquid friend(?: [IVXLCDM]+)?|uncle plasma(?: [IVXLCDM]+)?) .+ a consumer!/i);
			if(matcher) {
				return {
					emoji: 0x1F4AA,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }],
					unimportant: true
				}
			}
			matcher = outcome.match(/steeled (.+) countered a consumer attack!/i);
			if(matcher) {
				return {
					emoji: 0x1FA91,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }],
					unimportant: true
				}
			}
			matcher = outcome.match(/(.+) flipped (.+) negative\./i);
			if(matcher) {
				return {
					emoji: 0x1F4A8	,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>"),
					players: [{ name: matcher[1], team: null }, { name: matcher[2], team: null }]
				}
			}
			matcher = outcome.match(/^(.+) became an echo!$/i);
			if(matcher) {
				return {
					emoji: 0x1F50A,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/^(.+) and (.+) echoed into static\.$/i);
			if(matcher) {
				return {
					emoji: 0x1F4AC,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>"),
					players: [
						{ name: matcher[1], team: null },
						{ name: matcher[2], team: null }
					]
				}
			}
			matcher = outcome.match(/^consumers attack\s(?:scattered\s)?(.+)$/i);
			if(matcher) {
				return {
					emoji: 0x1F988,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/^(.+) catches some rays.$/i);
			if(matcher) {
				return {
					emoji: 0x2600,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/^the black hole burps!\s(.+) is compressed by gamma!$/i);
			if(matcher) {
				return {
					emoji: 0x26AB,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/^(.+) replaced (.+) in a night shift\.$/i);
			if(matcher) {
				return {
					emoji: 0x1F319,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>"),
					players: [
						{ name: matcher[1], team: null },
						{ name: matcher[2], team: null }
					]
				}
			}
			matcher = outcome.match(/^the (.+) won the prize match!$/i);
			if(matcher) {
				var team = getTeamByName(matcher[1]);
				return {
					emoji: 0x1F381,
					formatted: outcome.replace(matcher[1], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team.get("secondaryColor") + "'>" + team.get("nickname") + "</strong>"),
					teams: [ team.id ]
				}
			}
			matcher = outcome.match(/^(.+) was replaced by incoming (?:fax|voicemail) ([^\.]+)\.$/i);
			if(matcher) {
				return {
					emoji: 0x1F4E0,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>"),
					players: [{ name: matcher[1], team: null }, { name: matcher[2], team: null }]
				}
			}
			matcher = outcome.match(/^(.+) (?:placed|took) the fifth base (?:in|from) (.+)\.$/i);
			if(matcher) {
				return {
					emoji: 0x1F590,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>"),
					players: [{ name: matcher[1], team: null }]
				}
			}
			matcher = outcome.match(/^(.+) thieves' guild stole (.+) from (.+) and give it to (.+)\.$/i);
			if(matcher) {
				return {
					emoji: 0x1F978,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>").replace(matcher[3], "<strong>" + matcher[3] + "</strong>").replace(matcher[4], "<strong>" + matcher[4] + "</strong>"),
					players: [
						{ name: matcher[3], team: null },
						{ name: matcher[4], team: null }
					]
				}
			}
			matcher = outcome.match(/^(.+) thieves' guild stole (.+) from the (.+) and gave them to the (.+)\.$/i);
			if(matcher) {
				var team1 = getTeamByName(matcher[3]), team2 = getTeamByName(matcher[4]);
				return {
					emoji: 0x1F978,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>").replace(matcher[3], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team1.get("secondaryColor") + "'>" + team1.get("nickname") + "</strong>").replace(matcher[4], "<strong class='team-name' style='" + (lightMode ? "background" : "color") + ":" + team2.get("secondaryColor") + "'>" + team2.get("nickname") + "</strong>"),
					teams: [ team1.id, team2.id ]
				}
			}
			matcher = outcome.match(/black hole \(black hole\) nullified (.+))!/i);
			if(matcher) {
				return {
					emoji: 0x1F533,
					formatted: outcome.replace(matcher[1], "<strong>" + matcher[1] + "</strong>").replace(matcher[2], "<strong>" + matcher[2] + "</strong>")
				}
			}
			matcher = outcome.match(/BRIDGE WEAKENED/i);
			if(matcher) {
				return {
					emoji: 0x1F4A3,
					formatted: outcome
				};
			}
			matcher = outcome.match(/PLANAR WAVES DETECTED/i);
			if(matcher) {
				return {
					emoji: 0x1F30A,
					formatted: outcome
				};
			}
			matcher = outcome.match(/SPILLOVER DETECTED/i);
			if(matcher) {
				return {
					emoji: 0x231B,
					formatted: outcome
				};
			}
			matcher = outcome.match(/SIESTA DETECTED/i);
			if(matcher) {
				return {
					emoji: 0x1F6CF,
					formatted: outcome
				};
			}
			console.log(outcome);
			return {
				emoji: 0x2753,
				formatted: outcome,
				unimportant: true
			};
		}
	});
	App.Models.Detail = Backbone.Model.extend({});
	//-- END MODELS --
	
	//-- BEGIN COLLECTIONS --
	App.Collections.Teams = Backbone.Collection.extend({
		url: "https://api.sibr.dev/corsmechanics/www.blaseball.com/database/allTeams",
		model: App.Models.Team,
		emoji: parseEmoji,
		isLightMode: function() {
			return lightMode;
		}
	});
	App.Collections.Seasons = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v2/versions?type=season",
		model: App.Models.Season,
		parse: function(data) {
			return [{ seasonNumber: 0 }].concat(_.pluck(_.uniq(data.items, function(item) { return item.entityId; }), "data"));
		}
	});
	App.Collections.Games = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v1/games",
		model: App.Models.Game,
		parse: function(data) {
			var parsedData = data.data, teamWins = {}, teamLosses = {}, seriesWins = {}, seriesLosses = {}, playoffSeriesStarted = 0;
			
			parsedData = _.chain(parsedData)
				.filter(function(data) {
					return data.startTime && data.endTime && !(data.data.state && data.data.state.game_cancelled);
				})
				.map(function(data) {
					var awayTeam = navView.model.get("teams").get(data.data.awayTeam), 
						homeTeam = navView.model.get("teams").get(data.data.homeTeam),
						weatherIndex = weather && data.data.weather < weather.length ? data.data.weather : 0,
						game = {
							away: {
								emoji: awayTeam.get("emoji"),
								fullName: awayTeam.canonicalName(),
								id: awayTeam.id,
								isAway: true,
								location: awayTeam.get("location") == "Unlimited" ? "Infinite Los Angeli" : awayTeam.get("location"),
								mainColor: awayTeam.get("mainColor"),
								nickname: awayTeam.canonicalNickname(),
								odds: data.data.awayOdds,
								pitcher: data.data.awayPitcherName,
								score: data.data.awayScore,
								secondaryColor: awayTeam.get("secondaryColor")
							},
							day: data.data.day,
							duration: new Date(data.endTime) - new Date(data.startTime),
							home: {
								emoji: homeTeam.get("emoji"),
								fullName: homeTeam.canonicalName(),
								id: homeTeam.id,
								isAway: false,
								location: homeTeam.get("location") == "Unlimited" ? "Infinite Los Angeli" : homeTeam.get("location"),
								mainColor: homeTeam.get("mainColor"),
								nickname: awayTeam.canonicalNickname(),
								odds: data.data.homeOdds,
								pitcher: data.data.homePitcherName,
								score: data.data.homeScore,
								secondaryColor: homeTeam.get("secondaryColor")
							},
							id: data.gameId,
							innings: data.data.inning,
							isPrizeMatch: data.data.state && data.data.state.prizeMatch,
							isPostseason: data.data.isPostseason,
							isShame: data.data.shame,
							isTitleMatch: data.data.isTitleMatch,
							isOverbracket: data.data.state && data.data.state.postseason && data.data.state.postseason.bracket === 0,
							isUnderbracket: data.data.state && data.data.state.postseason && data.data.state.postseason.bracket === 1,
							outcomes: data.data.outcomes,
							season: data.data.season,
							seriesIndex: data.data.seriesIndex,
							seriesLength: data.data.seriesLength,
							tournament: data.data.tournament,
							weather: weather && weatherIndex ? weather[weatherIndex] : { "name": "Pony", "emoji": "0x1F434" }
						};

						// have to manually fix a bug that occurred live lol
						switch(game.id) {
							case "9be97d2b-55bc-4559-83f1-b35e14c735d8":
							case "8bef2e9a-5e33-4163-b040-27ecdff71e2b":
							case "910e769d-46c8-44f8-a162-8d7f214640fe":
							case "83e408d3-03a2-449b-83df-4b0648ddd083":
								game.seriesIndex = 2;
								break;
						}
						
						if(!teamWins.hasOwnProperty(game.away.id)) {
							teamWins[game.away.id] = 0;
							teamLosses[game.away.id] = 0;
						}
						if(!teamWins.hasOwnProperty(game.home.id)) {
							teamWins[game.home.id] = 0;
							teamLosses[game.home.id] = 0;
						}
						
						if(game.seriesIndex === 1) {
							seriesWins[game.away.id] = 0;
							seriesWins[game.home.id] = 0;
							seriesLosses[game.away.id] = 0;
							seriesLosses[game.home.id] = 0;
							if(game.isPostseason) {
								playoffSeriesStarted++;
							}
						}
						
						// wild cards were implemented season 9 and over/under brackets were implemented season 20
						if(playoffSeriesStarted > 16 || (game.season < 19 && playoffSeriesStarted > 8) || (game.season < 8 && playoffSeriesStarted > 6)) {
							game.playoffRound = "Internet Series";
						} else if(playoffSeriesStarted > 12 || (game.season < 19 && playoffSeriesStarted > 6) || (game.season < 8 && playoffSeriesStarted > 4)) {
							game.playoffRound = "Championship Series";
						} else if(playoffSeriesStarted > 4 || (game.season < 19 && playoffSeriesStarted > 2) || game.season < 8) {
							game.playoffRound = "Division Series";
						} else {
							game.playoffRound = "Wild Cards";
						}
						
						_.each(game.outcomes, function(outcome) {
							var matcher = outcome.match(/sun 2 (?:smiled at|set a win upon) the ([^\.]+)\.?/i);
							if(matcher) {
								if(matcher[1] == game.away.nickname) {
									teamWins[game.away.id]++;
									seriesWins[game.away.id]++;
								}
								if(matcher[1] == game.home.nickname) {
									teamWins[game.home.id]++;
									seriesWins[game.home.id]++;
								}
							}
							matcher = outcome.match(/sun 30 smiled upon the .+ and .+\./i);
							if(matcher) {
								teamWins[game.away.id]++;
								seriesWins[game.away.id]++;
								teamWins[game.home.id]++;
								seriesWins[game.home.id]++;
							}
							matcher = outcome.match(/the black hole burped at the (.+)!/i);
							if(matcher) {
								if(matcher[1] == game.away.nickname) {
									teamWins[game.away.id]++;
									seriesWins[game.away.id]++;
								}
								if(matcher[1] == game.home.nickname) {
									teamWins[game.home.id]++;
									seriesWins[game.home.id]++;
								}
							}
							matcher = outcome.match(/the black hole swallowed a win from the (.+)!/i);
							if(matcher) {
								if(matcher[1] == game.away.nickname) {
									teamWins[game.away.id]--;
									seriesWins[game.away.id]--;
								}
								if(matcher[1] == game.home.nickname) {
									teamWins[game.home.id]--;
									seriesWins[game.home.id]--;
								}
							}
						});
						
						game.away.isWinner = game.away.score > game.home.score;
						if(game.isUnderbracket) {
							game.away.isWinner = !game.away.isWinner;
						}
						game.home.isWinner = !game.away.isWinner;
						if(game.away.isWinner) {
							game.away.wins = ++teamWins[game.away.id];
							game.away.losses = teamLosses[game.away.id];
							game.away.seriesWins = ++seriesWins[game.away.id];
							game.away.seriesLosses = seriesLosses[game.away.id];
							game.home.wins = teamWins[game.home.id];
							game.home.losses = ++teamLosses[game.home.id];
							game.home.seriesWins = seriesWins[game.home.id];
							game.home.seriesLosses = ++seriesLosses[game.home.id];
						} else {
							game.away.wins = teamWins[game.away.id];
							game.away.losses = ++teamLosses[game.away.id];
							game.away.seriesWins = seriesWins[game.away.id];
							game.away.seriesLosses = ++seriesLosses[game.away.id];
							game.home.wins = ++teamWins[game.home.id];
							game.home.losses = teamLosses[game.home.id];
							game.home.seriesWins = ++seriesWins[game.home.id];
							game.home.seriesLosses = seriesLosses[game.home.id];
						}

						if(game.playoffRound == "Internet Series" && game.home.seriesWins != game.away.seriesWins) {
							var champion;
							if(game.season < 10) {
								if(game.home.seriesWins >= game.seriesLength / 2) {
									champion = game.home;
								} else if(game.away.seriesWins >= game.seriesLength / 2) {
									champion = game.away;
								}
							} else if(game.home.seriesWins >= game.seriesLength) {
								champion = game.home;
							} else if(game.away.seriesWins >= game.seriesLength) {
								champion = game.away;
							}
							if(champion) {
								game.outcomes.push("Your " + (game.isOverbracket ? "Overbracket" : (game.isUnderbracket ? "Underbracket" : "Season")) + " " + (game.season + 1) + " Champions are the " + champion.nickname + "!");
							}
						}
						
						game.away.diff = game.away.wins - game.away.losses;
						game.home.diff = game.home.wins - game.home.losses;
						return game;
				})
				.sortBy("day")
				.value();
			
			return parsedData;
		}
	});
	App.Collections.Details = Backbone.Collection.extend({
		model: App.Models.Game
	});
	//-- END COLLECTIONS --
	
	//-- BEGIN VIEWS --
	App.Views.Nav = Backbone.View.extend({
		template: _.template($("#template-nav").html()),
		el: "nav",
		initialize: function() {
			var thisView = this;
			this.model.get("teams").fetch({
				success: function() {
					var groups = thisView.model.get("teams").groupBy(function(model) { return model.type(); });
					_.each(groups, function(group, key) {
						groups[key] = _.sortBy(group, function(model) { return model.get("shorthand"); });
					});
					thisView.model.get("teams").reset(_.union(groups.ilb/*, groups.coffee*/));
					thisView.render();
					if(activePage.team) {
						loadTeam(activePage.team);
					}
					if(activePage.season) {
						loadSeason(activePage.season);
					}
				},
				error: console.log
			});
			this.model.get("seasons").fetch({
				success: function() {
					if(teamView) {
						teamView.render();
					}
					if(activePage.season) {
						loadSeason(activePage.season);
					}
				},
				error: console.log
			})
		},
		render: function() {
			this.$el.html(this.template(this.model.get("teams")));
		},
		events: {
			"click a": "selectTeam"
		},
		selectTeam: function(e) {
			e.preventDefault();
			activeRouter.navigate(e.currentTarget.href.split("#")[1], { trigger: true });
		}
	});
	App.Views.Team = Backbone.View.extend({
		template: _.template($("#template-team").html()),
		el: "main",
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.html(this.template({ 
				team: this.model,
				seasons: navView ? navView.model.get("seasons") : null
			}));
		},
		events: {
			"click .seasons-content a": "selectSeason",
			"click a[data-toggle-lights]": "toggleLights"
		},
		selectSeason: function(e) {
			e.preventDefault();
			activeRouter.navigate(e.currentTarget.href.split("#")[1], { trigger: true });
		},
		toggleLights: function(e) {
			e.preventDefault();
			lightMode = !$(e.currentTarget).data("toggle-lights");
			$(e.currentTarget).data("toggle-lights", lightMode);
			$("#root").addClass("transition");
			$("#root").toggleClass("dark", !lightMode);
			$(e.currentTarget).html(lightMode ? parseEmoji(0x1F506) : parseEmoji(0x1F311));
			if(navView) {
				navView.render();
			}
			if(detailsView) {
				detailsView.render();
			}
			if(localStorageExists()) {
				localStorage.setItem("lightModeState", lightMode);
			}
			gtag('event', 'toggle_lights');
		}
	});
	App.Views.Season = Backbone.View.extend({
		template: _.template($("#template-chart").html()),
		el: "section.chart",
		initialize: function() {
			var thisView = this;
			if(this.model.get("games")) {
				this.render();
			} else {
				this.model.set("games", new App.Collections.Games());
				this.model.get("games").fetch({
					data: {
						season: this.model.get("seasonNumber"),
						started: true
					},
					success: function() {
						thisView.render();
					}
				});
			}
		},
		getTeamGames: function() {
			return new App.Collections.Details(this.model.get("games").chain().filter(function(game) { 
				return _.contains([game.get("away").id, game.get("home").id], activeTeam.id); 
			}).map(function(game) {
				if(game.get("away").id == activeTeam.id) {
					game.set("opponent", game.get("home"));
					game.set("team", game.get("away"));
				} else {
					game.set("opponent", game.get("away"));
					game.set("team", game.get("home"));
				}
				return game;
			}).value())
		},
		maxWinDiff: function() {
			return 89 - 19; // season 6 crabs
		},
		maxLossDiff: function() {
			return 77 - 11; // season 13 worms
		},
		render: function() {
			$("section.details").remove();
			if($(".team-season").length) {
				$(".team-season").html("Season " + (activeSeason.get("seasonNumber") + 1));
			} else {
				$(".team-info").prepend("<div class='team-season'>Season " + (activeSeason.get("seasonNumber") + 1) + "</div>");
			}
			
			var thisView = this, 
				svg = { 
					height: $("main").innerHeight(), 
					width: $(window).width(), 
					bars: [],
					outlines: []
				}, 
				games = this.getTeamGames(),
				barWidth = svg.width / Math.max(99, games.length),
				barHeightUnit = svg.height / (this.maxWinDiff() + this.maxLossDiff());
			
			games.each(function(game, index) {
				var prevDiff = index > 0 ? games.at(index - 1).get("team").diff: 0,
					nextDiff = index < games.length - 1 ? games.at(index + 1).get("team").diff : -1, 
					isAbove = game.get("team").diff >= 0,
					nextPostseason = index < games.length - 1 && games.at(index + 1).get("isPostseason"),
					xPos = barWidth * index,
					yPos = thisView.maxWinDiff() * svg.height / (thisView.maxWinDiff() + thisView.maxLossDiff()),
					xRadius = Math.min(barHeightUnit, barWidth / 2),
					yRadius = (isAbove ? 1 : -1) * xRadius,
					barHeight = barHeightUnit * game.get("team").diff,
					bar = { above: isAbove, color: "transparent", id: game.id, outcomes: game.relevantOutcomes(), path: null, height: barHeight, radius: barWidth, x: xPos, y: yPos };
					
				if(!svg.outlines.length) {
					svg.outlines.push({
						above: isAbove,
						path: ["M", xPos, yPos],
						postseason: false
					});
				}
				if(isAbove && prevDiff < 0) {
					_.last(svg.outlines).path.push(
						"L", xPos, yPos,
						"z"
					);
				}
				if(game.get("team").diff === 0) {
					bar.path = [
						"M", xPos, yPos - 1, 
						"L", xPos, yPos + 1,
						"L", xPos + barWidth, yPos + 1,
						"L", xPos + barWidth, yPos - 1,
						"z"
					];
					bar.color = "#999999";
				} else {
					bar.path = [
						"M", xPos, yPos
					];
					if(game.get("team").diff > 0 && prevDiff > game.get("team").diff || game.get("team").diff < 0 && prevDiff < game.get("team").diff) {
						bar.path.push(
							"L", xPos, yPos - barHeight
						);
						_.last(svg.outlines).path.push(
							"L", xPos, yPos - barHeight
						);
					} else if(game.get("team").diff > 0 && prevDiff < game.get("team").diff || game.get("team").diff < 0 && prevDiff > game.get("team").diff) {
						bar.path.push(
							"L", xPos, yPos - barHeight + yRadius,
							"Q", xPos, yPos - barHeight, xPos + xRadius, yPos - barHeight
						);
						_.last(svg.outlines).path.push(
							"L", xPos, yPos - barHeight + yRadius,
							"Q", xPos, yPos - barHeight, xPos + xRadius, yPos - barHeight
						);
					} else {
						bar.path.push(
							"L", xPos, yPos - barHeight
						);
					}
					if(game.get("team").diff > 0 && nextDiff > game.get("team").diff || game.get("team").diff < 0 && nextDiff < game.get("team").diff) {
						bar.path.push(
							"L", xPos + barWidth, yPos - barHeight
						);
						_.last(svg.outlines).path.push(
							"L", xPos + barWidth, yPos - barHeight
						);
					} else if(game.get("team").diff > 0 && nextDiff < game.get("team").diff || game.get("team").diff < 0 && nextDiff > game.get("team").diff) {
						bar.path.push(
							"L", xPos + barWidth - xRadius, yPos - barHeight,
							"Q", xPos + barWidth, yPos - barHeight, xPos + barWidth, yPos - barHeight + yRadius
						);
						_.last(svg.outlines).path.push(
							"L", xPos + barWidth - xRadius, yPos - barHeight,
							"Q", xPos + barWidth, yPos - barHeight, xPos + barWidth, yPos - barHeight + yRadius
						);
					} else {
						bar.path.push(
							"L", xPos + barWidth, yPos - barHeight
						);
					}
					bar.path.push(
						"L", xPos + barWidth, yPos,
						"z"
					);
				}
				svg.bars.push(bar);
				if(nextDiff > 0 && game.get("team").diff <= 0 || nextDiff < 0 && game.get("team").diff >= 0  || !game.get("isPostseason") && nextPostseason) {
					if(game.get("team").diff !== 0) {
						_.last(svg.outlines).path.push(
							"L", xPos + barWidth, yPos,
							"z"
						);
					}
					svg.outlines.push({
						above: nextDiff >= 0,
						path: ["M", xPos + barWidth, yPos],
						postseason: nextPostseason
					});
				}
			});
			if(svg.outlines.length) {
				_.last(svg.outlines).path.push(
					"L", games.length * barWidth, this.maxWinDiff() * svg.height / (this.maxWinDiff() + this.maxLossDiff()),
					"z"
				);
			}
			
			this.$el.html(this.template({
				emojiSvg: function(emoji) {
					return $(parseEmoji(emoji, { "folder": "svg", "ext": ".svg" })).attr("src");
				},
				games: games,
				svg: svg
			}));
		},
		events: {
			"mouseenter circle.outcome, image.outcome, path.bar": "showDetails",
			"mouseleave circle.outcome, image.outcome, path.bar": "hideDetails"
		},
		showDetails: function(e) {
			var id = $(e.currentTarget).data("id"), 
				game = this.model.get("games").get(id),
				padding = isMobile() ? 10 : 20,
				heightRatio = $("main").innerHeight() / (this.maxWinDiff() + this.maxLossDiff()),
				style = {};
			if(id) {				
				if(e.clientX + $("section.details").outerWidth() / 2 + padding > $(window).width()) {
					style.right = padding;
				} else if(e.clientX - padding - $("section.details").outerWidth() / 2 > 0) {
					style.left = Math.max(e.clientX, padding) - $("section.details").outerWidth() / 2;
				} else {
					style.left = padding;
				}
				if(game.get("team").diff < 0) {
					style.bottom = padding + heightRatio * this.maxLossDiff();
					style.maxHeight = $("main").innerHeight() - style.bottom - (isMobile() ? 3 : 2) * padding;
				} else {
					style.top = padding + heightRatio * this.maxWinDiff();
					style.maxHeight = $("main").innerHeight() - style.top - (isMobile() ? 3 : 2) * padding;
				}
				detailsView = new App.Views.Details({ 
					model: new App.Models.Detail({ game: game, style: style })
				});
			}
		},
		hideDetails: function(e) {
			var id = $(e.currentTarget).data("id");
			if(isMobile() && id) {
				$("[data-id=" + id + "]").removeClass("active");
				$("section.details").remove();
			}
		}
	});
	App.Views.Details = Backbone.View.extend({
		template: _.template($("#template-details").html()),
		initialize: function() {
			this.render();
		},
		render: function() {
			$("circle.outcome, image.outcome, path.bar").removeClass("active");
			$("section.details").remove();
			$("[data-id=" + this.model.get("game").id + "]").addClass("active");
			$("main").append(this.template({
				emoji: parseEmoji,
				game: this.model.get("game"),
				isLightMode: function() {
					return lightMode;
				}
			}));
			$("section.details").css(this.model.get("style"));
		}
	});
	
	//-- CHECK FOR SAVED DATA --
	if(localStorageExists()) {
		if(localStorage.getItem("lightModeState") != null) {
			lightMode = localStorage.getItem("lightModeState") == "true";
		}
	}
	//-- CHECKED FOR SAVED DATA --
	
	$("#root").toggleClass("dark", !lightMode);
	
	activeRouter = new App.Router;
	Backbone.history.start();
	
	if(window.location.search) {
		var team, season;
		_.each(window.location.search.substring(1).split("&"), function(searchParam) {
			var split = searchParam.split("=");
			switch(split[0]) {
				case "team":
					team = split[1];
					break;
				case "season":
					season = split[1];
			}
		});
		if(team) {
			if(typeof season != "undefined" && season > -1) {
				var path = team + "/season/" + season;
				history.replaceState(null, "", window.location.pathname + "#" + path);
				activeRouter.navigate(path, { trigger: true, replace: true });
			} else {
				history.replaceState(null, "", window.location.pathname + "#" + team);
				activeRouter.navigate(team, { trigger: true, replace: true });
			}
		}
	}
	
	window.onresize = function() {
		if(seasonView) {
			seasonView.render();
		}
		if(detailsView) {
			detailsView.render();
		}
	};
	
	function isMobile() {
		return /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent) || $(window).width() < 700;
	}

	function loadHistory(team) {
		if(!navView) {
			navView = new App.Views.Nav({ 
				model: new App.Models.Nav({
					teams: new App.Collections.Teams(), 
					seasons: new App.Collections.Seasons()
				})
			});
		}
		activePage.history = true;
		activePage.season = null;
		activeSeason = null;
		if(team != activePage.team) {
			loadTeam(team);
		}
		if(activeTeam && navView.model.get("seasons").length) {
			activeSeason = navView.model.get("seasons").findWhere({ seasonNumber: parseInt(activePage.season - 1) });
			if(seasonView) {
				seasonView.undelegateEvents();
			}
			seasonView = new App.Views.Season({
				model: activeSeason
			});
			loadPageView();
		}
	}
	
	function loadPage(team, season) {
		if(!navView) {
			navView = new App.Views.Nav({ 
				model: new App.Models.Nav({
					teams: new App.Collections.Teams(), 
					seasons: new App.Collections.Seasons()
				})
			});
		}
		if(!season) {
			activePage.season = null;
			activeSeason = null;
		}
		if(team) {
			if(team != activePage.team) {
				loadTeam(team);
			}
			if(season) {
				loadSeason(season);
			}
		} else {
			$("main").html(_.template($("#template-index").html())({ isLightMode: function() { return lightMode; }, emoji: parseEmoji }));
			$("section.index a:last-child").click(function(e) {
				e.preventDefault();
				lightMode = !lightMode;
				$("#root").addClass("transition");
				$("#root").toggleClass("dark", !lightMode);
				$(e.currentTarget).html(lightMode ? parseEmoji(0x1F506) : parseEmoji(0x1F311));
				if(navView) {
					navView.render();
				}
				if(localStorageExists()) {
					localStorage.setItem("lightModeState", lightMode);
				}
				gtag('event', 'toggle_lights');
			});				
		}
	}
	
	function loadTeam(id) {
		activePage.team = id;
		if(navView.model.get("teams").length) {
			activeTeam = navView.model.get("teams").find(function(model) {
				return model.id == id || model.slug() == id;
			});
			if(teamView) {
				teamView.undelegateEvents();
			}
			teamView = new App.Views.Team({
				model: activeTeam
			});
			loadPageView();
		}
	}
	
	function loadSeason(number) {
		activePage.season = number;
		if(activeTeam && navView.model.get("seasons").length) {
			activeSeason = navView.model.get("seasons").findWhere({ seasonNumber: parseInt(activePage.season - 1) });
			if(seasonView) {
				seasonView.undelegateEvents();
			}
			seasonView = new App.Views.Season({
				model: activeSeason
			});
			loadPageView();
		}
	}
	
	function loadPageView() {
		var title = "Chart Party", path = "/";
		if(activeTeam) {
			title += " - " + activeTeam.canonicalName();
			path += activeTeam.slug();
		} 
		document.title = title;
		gtag('event', 'page_view', { page_title: title, page_location: window.location.href, page_path: path, send_to: GA_TRACKING_ID });
	}
	
	function parseEmoji(emoji, options) {
		return twemoji.parse(isNaN(Number(emoji)) ? emoji : twemoji.convert.fromCodePoint(emoji), options);
	}
	
	function getTeamByName(name) {
		return navView.model.get("teams").findWhere({ nickname: name.normalize("NFD").replace(/[\u0300-\u036f]/g, "") });
	}
	
	function localStorageExists() {
		if(window.localStorage){
			window.localStorage.setItem("test", "test");
			if(window.localStorage.getItem("test")){
				window.localStorage.removeItem("test");
				return true;
			}
		}
		return false;
	}
});