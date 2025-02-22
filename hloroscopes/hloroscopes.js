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
		twemoji: "https://unpkg.com/twemoji@latest/dist/twemoji.min" //why isn't this workig
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
requirejs(["jquery", "underscore", "backbone", "twemoji", "json!../blaseball/teams.json", "json!../blaseball/modifiers.json", "json!../blaseball/items.json", "json!../blaseball/weather.json"], function($, _, Backbone, twemoji, teamTypes, modifiers, oldItems, weathers) {
	var App = {Models: {}, Collections: {}, Views: {}, Router: {}}, activeRouter, activePage = { team: null, player: null, style: "chart" }, activeTeam, activePlayer, globalLoaded = { players: false, teams: false, times: false }, globalPlayers, globalTeams, globalTimes, navView, teamView, updatesView, advancedView, historyView, stadiumView, updates = {}, secretsVisible = false, evenlySpaced = false, lightMode = false;
	
	//-- BEGIN ROUTER --
	App.Router = Backbone.Router.extend({
		routes: {
			"": "index",
			":team": "team",
			":team/:player": "chart",
			":team/:player/advanced": "table"
		},
		index: loadAssets,
		team: loadAssets,
		chart: loadChart,
		table: loadTable
	});
	//-- END ROUTER --

	//-- BEGIN MODELS --
	App.Models.Nav = Backbone.Model.extend({});
	App.Models.Time = Backbone.Model.extend({
		toString: function() {
			var str = "Season " + this.get("season");
			if(this.get("season") == 11 && this.get("day") == 0) {
				return "Expansion Era Begins";
			}
			if(this.get("season") < 12) {
				switch(this.get("type")) {
					case "pre_election":
					case "post_election":
						return str + " Elections";
					case "bossfight":
						return str + " Day X";
					case "tournament":
						return "Coffee Cup";
				}
			} else {
				switch(this.get("type")) {
					case "tournament": // actually phase 13 election
					case "post_election":
						return str + " Elections";
				}
			}
			return str + " Day " + this.get("day");
		},
		toDateLabel: function() {
			var str = "S" + this.get("season");
			if(this.get("season") == 11 && this.get("day") == 0) {
				return "S12D1";
			}
			if(this.get("season") < 12) {
				switch(this.get("type")) {
					case "pre_election":
					case "post_election":
						return str + " Elections";
					case "bossfight":
						return str + "DX";
					case "tournament":
						return "Coffee Cup";
				}
			} else {
				switch(this.get("type")) {
					case "tournament": // actually phase 13 election
					case "post_election":
						return str + " Elections";
				}
			}
			return str + "D" + this.get("day");
		}
	});
	App.Models.Team = Backbone.Model.extend({
		canonicalName: function() {
			if(!_.isEmpty(this.get("state")) && _.has(this.get("state"), "scattered")) {
				return this.get("state").scattered.fullName;
			}
			return this.get("fullName");
		},
		slug: function() {
			if(this.get("fullName") == "nullteam" || this.type() == "unknown") {
				return this.id;
			}
			if(this.id == "9494152b-99f6-4adb-9573-f9e084bc813f") {
				return "baltimore-clabs";
			}
			return this.canonicalName().toLowerCase().replace(/\&/g, "-and-").replace(/[\,\.\']+/g, "").replace(/[\-\s]+/g, "-") + (this.type().startsWith("gamma") ? ("-" + this.type()) : "");
		},
		type: function() {
			var thisId = this.id;
			return this.get("type") || _.findKey(teamTypes, function(ids) { return _.contains(ids, thisId); }) || "unknown";
		},
		players: function(position) {
			var teamPlayers = this.get("filtered") ? this.get("filtered") : this.get("players");
			return _.template($("#template-players").html())({
				emoji: parseEmoji,
				position: position, 
				players: position == "Players" ? teamPlayers.models : (teamPlayers ? _.chain(this.get(position.toLowerCase())).map(function(id) {
					return teamPlayers.findWhere({ id: id });
				}).compact().value() : [])
			});
		},
		modifiers: function() {
			return _.union(this.get("permAttr"), this.get("seasAttr"));
		},
		arcana: function() {
			switch(this.get("card")) {
				case -1:
					return "Fool";
				case 0:
					return "I The Magician";
				case 1:
					return "II The High Priestess";
				case 2:
					return "III The Empress";
				case 3:
					return "IIII The Emperor";
				case 4:
					return "V The Hierophant";
				case 5:
					return "VI The Lover";
				case 6:
					return "VII The Chariot";
				case 7:
					return "VIII Justice";
				case 8:
					return "VIIII The Hermit";
				case 9:
					return "X The Wheel of Fortune";
				case 10:
					return "XI Strength";
				case 11:
					return "XII The Hanged Man";
				case 12:
					return "XIII";
				case 13:
					return "XIIII Temperance";
				case 14:
					return "XV The Devil";
				case 15:
					return "XVI The Tower";
				case 16:
					return "XVII The Star";
				case 17:
					return "XVIII The Moon";
				case 18:
					return "XVIIII The Sun";
				case 19:
					return "XX Judgment";
				default:
					return null;
			}
		},
		level: function() {
			switch(this.get("level")) {
				case 0:
					return "0D";
				case 1:
					return "1D";
				case 2:
					return "2D";
				case 3:
					return "3D";
				case 4:
					return "C";
				case 5:
					return "Low A";
				case 6:
					return "High A";
				case 7:
					return "AA";
				case 8:
					return "AAA";
				case 9:
					return "AAAA";
				case 10:
					return "AAAAA";
				default:
					return null;
			}
		},
		emoji: parseEmoji,
		getModifier: getModifier,
		isForbidden: function() {
			return secretsVisible;
		},
		isEvenlySpaced: function() {
			return evenlySpaced;
		},
		isLightMode: function() {
			return lightMode;
		}
	});
	App.Models.PlayerId = Backbone.Model.extend({});
	App.Models.Name = Backbone.Model.extend({});
	App.Models.Player = Backbone.Model.extend({
		canonicalName: function() {
			if(!_.isEmpty(this.get("state")) && _.has(this.get("state"), "unscatteredName")) {
				return this.get("state").unscatteredName;
			}
			return this.get("name");
		},
		slug: function() {
			if(this.id == "5d063a91-31b3-4688-97a7-e34a7181da30") {
				return "baby-pitching-machine";
			}
			return (activeTeam ? activeTeam.slug() + "/" : "") + this.canonicalName().toLowerCase().replace(/\,/g, "-comma-").replace(/[\.\']+/g, "").replace(/[\-\s]+/g, "-");
		},
		calculateBatting: function() {
			var adjustments = this.getStatAdjustments();
			return (
				Math.pow(Math.max(1 - this.get("tragicness") + _.get(adjustments, "tragicness", 0), 0.001), 0.01) *
				Math.pow(Math.max(this.get("buoyancy") + _.get(adjustments, "buoyancy", 0), 0.001), 0) *
				Math.pow(Math.max(this.get("thwackability") + _.get(adjustments, "thwackability", 0), 0.001), 0.35) *
				Math.pow(Math.max(this.get("moxie") + _.get(adjustments, "moxie", 0), 0.001), 0.075) *
				Math.pow(Math.max(this.get("divinity") + _.get(adjustments, "divinity", 0), 0.001), 0.35) *
				Math.pow(Math.max(this.get("musclitude") + _.get(adjustments, "musclitude", 0), 0.001), 0.075) *
				Math.pow(Math.max(1 - this.get("patheticism") + _.get(adjustments, "patheticism", 0.001), 0), 0.05) *
				Math.pow(Math.max(this.get("martyrdom") + _.get(adjustments, "martyrdom", 0), 0.001), 0.02)
			);
		},
		calculatePitching: function() {
			var adjustments = this.getStatAdjustments();
			return (
				Math.pow(Math.max(this.get("shakespearianism") + _.get(adjustments, "shakespearianism", 0), 0.001), 0.1) *
				Math.pow(Math.max(this.get("suppression") + _.get(adjustments, "suppression", 0), 0.001), 0) *
				Math.pow(Math.max(this.get("unthwackability") + _.get(adjustments, "unthwackability", 0), 0.001), 0.5) *
				Math.pow(Math.max(this.get("coldness") + _.get(adjustments, "coldness", 0), 0.001), 0.025) *
				Math.pow(Math.max(this.get("overpowerment") + _.get(adjustments, "overpowerment", 0), 0.001), 0.15) *
				Math.pow(Math.max(this.get("ruthlessness") + _.get(adjustments, "ruthlessness", 0), 0.001), 0.4)
			);
		},
		calculateBaserunning: function() {
			var adjustments = this.getStatAdjustments();
			return (
				Math.pow(Math.max(this.get("laserlikeness") + _.get(adjustments, "laserlikeness", 0), 0.001), 0.5) *
				Math.pow(Math.max(this.get("continuation") + _.get(adjustments, "continuation", 0), 0.001), 0.1) *
				Math.pow(Math.max(this.get("baseThirst") + _.get(adjustments, "baseThirst", 0), 0.001), 0.1) *
				Math.pow(Math.max(this.get("indulgence") + _.get(adjustments, "indulgence", 0), 0.001), 0.1) *
				Math.pow(Math.max(this.get("groundFriction") + _.get(adjustments, "groundFriction", 0), 0.001), 0.1)
			);
		},
		calculateDefense: function() {
			var adjustments = this.getStatAdjustments();
			return (
				Math.pow(Math.max(this.get("omniscience") + _.get(adjustments, "omniscience", 0), 0.001), 0.2) *
				Math.pow(Math.max(this.get("tenaciousness") + _.get(adjustments, "tenaciousness", 0), 0.001), 0.2) *
				Math.pow(Math.max(this.get("watchfulness") + _.get(adjustments, "tragicness", 0), 0.001), 0.1) *
				Math.pow(Math.max(this.get("anticapitalism") + _.get(adjustments, "anticapitalism", 0), 0.001), 0.1) *
				Math.pow(Math.max(this.get("chasiness") + _.get(adjustments, "chasiness", 0), 0.001), 0.1)
			);
		},
		calculateSoulscream: function() {
			var soulscream = "",
				letters = ["A", "E", "I", "O", "U", "X", "H", "A", "E", "I"], 
				stlats = [this.get("pressurization"), this.get("divinity"), this.get("tragicness"), this.get("shakespearianism"), this.get("ruthlessness")];
		  
			for(var i = 0; i < Math.min(this.get("soul"), 300); i++) {
				var magnitude = 1 / Math.pow(10, i);
				for(var j = 0; j < 11; j++) {
					soulscream += letters[Math.floor(((stlats[j % stlats.length] % magnitude) / magnitude) * 10)];
				}
			}
			if(i < this.get("soul")) {
				soulscream += "... (CONT. FOR " + (this.get("soul") - i) + " SOUL)";
			}
			return soulscream;
		},
		blood: function() {
			switch(this.get("blood")) {
				case 0:
					return "A";
				case 1:
					return "AAA";
				case 2:
					return "AA";
				case 3:
					return "Acidic";
				case 4:
					return "Basic";
				case 5:
					return "O";
				case 6:
					return "O No";
				case 7:
					return "H2O";
				case 8:
					return "Electric";
				case 9:
					return "Love";
				case 10:
					return "Fire";
				case 11:
					return "Psychic";
				case 12:
					return "Grass";
				default:
					return "Blood?";
			}
		},
		coffee: function() {
			switch(this.get("coffee")) {
				case 0:
					return "Black";
				case 1:
					return "Light & Sweet";
				case 2:
					return "Macchiato";
				case 3:
					return "Cream & Sugar";
				case 4:
					return "Cold Brew";
				case 5:
					return "Flat White";
				case 6:
					return "Americano";
				case 7:
					return "Espresso";
				case 8:
					return "Heavy Foam";
				case 9:
					return "Latte";
				case 10:
					return "Decaf";
				case 11:
					return "Milk Substitute";
				case 12:
					return "Plenty of Sugar";
				case 13:
					return "Anything";
				default:
					return "Coffee?";
			}
		},
		modifiers: function() {
			return {
				game: this.get("gameAttr") || [],
				item: _.chain([getLegendaryItem(this.get("bat")), getLegendaryItem(this.get("armor"))])
					.pluck("attr")
					.compact()
					.union(this.get("itemAttr"))
					.value(),
				permanent: _.reject(_.union(this.get("permAttr") || [], ), function(attr) { return _.contains(["COFFEE_RALLY", "ELSEWHERE", "HEATING_UP", "INHABITING", "MAGMATIC", "ON_FIRE", "OVERPERFORMING", "UNDERPERFORMING"], attr); }),
				seasonal: this.get("seasAttr") || [],
				weekly: this.get("weekAttr") || []
			};
		},
		teams: function() {
			return {
				league: this.get("leagueTeamId"),
				tournament: this.get("tournamentTeamId")
			};
		},
		vibes: function() {
			var adjustments = this.getStatAdjustments();
			if(this.get("buoyancy") && this.has("cinnamon") && this.has("pressurization")) {
				return {
					frequency: 6 + Math.round(10 * Math.max(this.get("buoyancy") + _.get(adjustments, "buoyancy", 0), 0.001)),
					minimum: -1 * Math.max(this.get("pressurization") + _.get(adjustments, "pressurization", 0), 0.001),
					maximum: Math.max(this.get("cinnamon") + _.get(adjustments, "cinnamon", 0), 0.001)
				};
			} else {
				return null;
			}
		},
		items: function() {
			return _.chain([getLegendaryItem(this.get("bat")), getLegendaryItem(this.get("armor"))])
				.union(this.get("items"))
				.compact()
				.map(function(item) { return new App.Models.Item(item); })
				.value()
		},
		getStatAdjustments: function() {
			return _.reduce(this.items(), function(i, j) {
				if(j.get("durability") < 0 || j.get("health") > 0) {
					_.each(j.getAggregateAdjustments(), function(value, stat) {
						if(!i.hasOwnProperty(stat)) {
							i[stat] = 0;
						}
						i[stat] += value;
					});
				}
				return i;
			}, {});
		}
	});
	App.Models.Update = Backbone.Model.extend({
		getInGameTime: function(isShort) {
			if(this.get("start") < new Date("2020-08-01T07:13:21.108Z")) {
				return "Before SIBR";
			} else if(this.get("start") > new Date("2021-10-26T00:00:00.000Z")) {
				return "Gamma"
			}
			var thisUpdate = this, foundTime = globalTimes.find(function(time) {
				return thisUpdate.get("start") >= time.get("start") && thisUpdate.get("start") <= time.get("end");
			});
			if(foundTime) {
				return isShort ? foundTime.toDateLabel() : foundTime.toString();
			}
			return this.get("start").toLocaleDateString() + " " + this.get("start").toLocaleTimeString();
		},
		getTeamById: function(id) {
			return globalTeams.findWhere({ id: id });
		},
		emoji: parseEmoji,
		getModifier: getModifier,
		vibeCheck: function(vibes) {
			var vibeSymbol = "", vibeText;
			if(vibes > 0.8) {
				vibeSymbol = "&#x1F845;&#x1F845;&#x1F845;";
				vibeText = "Most Excellent";
			} else if(vibes > 0.4) {
				vibeSymbol = "&#x1F845;&#x1F845;";
				vibeText = "Excellent";
			} else if(vibes > 0.1) {
				vibeSymbol = "&#x1F845;";
				vibeText = "Quality";
			} else if(vibes > -0.1) {
				vibeSymbol = "&#x2B0C;";
				vibeText = "Neutral";
			} else if(vibes > -0.4) {
				vibeSymbol = "&#x1F847;";
				vibeText = "Less Than Ideal";
			} else if(vibes > -0.8) {
				vibeSymbol = "&#x1F847;&#x1F847;";
				vibeText = "Far Less Than Ideal";
			} else {
				vibeSymbol = "&#x1F847;&#x1F847;&#x1F847;";
				vibeText = "Honestly Terrible";
			}
			vibeSymbol += " ";
			return "<span class='player-vibes vibe-" + vibeText.replace(/\s+/g, "-").toLowerCase() + "'>" + (isMobile() ? "" : vibeSymbol) + (secretsVisible ? vibes : vibeText) + "</span>";
		},
		getStatAdjustments: function() {
			return _.reduce(this.get("data").items, function(i, j) {
				if(j.get("durability") < 0 || j.get("health") > 0) {
					_.each(j.getAggregateAdjustments(), function(value, stat) {
						if(!i.hasOwnProperty(stat)) {
							i[stat] = 0;
						}
						i[stat] += value;
					});
				}
				return i;
			}, {});
		},
		getCombinedRoundedRating: function() {
			return Math.round(500 * (this.get("data").batting + this.get("data").pitching + this.get("data").baserunning + this.get("data").defense)) / 100;
		},
		getRoundedRating: function(rating) {
			return Math.round(500 * this.get("data")[rating]) / 100;
		},
		getRoundedAttribute: function(attribute) {
			var rating = this.get("raw")[attribute], 
				adjustment = _.get(this.getStatAdjustments(), attribute, 0),
				tag = "span", 
				hover = attribute + ": ";
			if(rating) {
				hover += Math.round(1000 * rating) / 1000;
				rating += adjustment;
				if(_.contains(["patheticism", "tragicness", "pressurization"], attribute)) {
					rating = Math.min(rating, 0.999);
				}
				if(!_.contains(["eDensity"], attribute)) {
					rating = Math.max(rating, 0.001);
				}
				rating = Math.round(1000 * rating) / 1000;
				if(adjustment) {
					tag = "em";
					hover += (adjustment > 0 ? " + " : " - ") + Math.abs(Math.round(1000 * adjustment) / 1000);
				}
			} else {
				hover += "-";
				rating = "-";
			}
			return "<" + tag + " title='" + hover + "'>" + rating + "</" + tag + ">";
		},
		getScaleClass: function(attribute) {
			var rating = this.get("raw")[attribute] + _.get(this.getStatAdjustments(), attribute, 0);
			if(_.contains(["patheticism", "tragicness", "pressurization"], attribute)) {
				rating = 1 - rating;
			}
			rating = Math.max(rating, 0.001);
			if(rating > 1.45) {
				return "stat-super-elite";
			} else if(rating > 1.15) {
				return "stat-elite";
			} else if(rating > 0.95) {
				return "stat-exceptional";
			} else if(rating > 0.85) {
				return "stat-great";
			} else if(rating > 0.65) {
				return "stat-good";
			}  else if(rating < 0.15) {
				return "stat-terrible";
			} else if(rating < 0.25) {
				return "stat-bad";
			} else if(rating < 0.45) {
				return "stat-poor";
			} else {
				return "stat-okay";
			};
		},
		getStarsForRating: function(rating) {
			var i, stars = "", rounded = Math.round(this.get("data")[rating] * 10);
			for(i = 0; i < Math.floor(rounded / 2); i++) {
				stars += "<i class='full-star'>" + parseEmoji(0x2B50) + "</i>";
			}
			if(rounded % 2) {
				stars += "<i class='half-star'>" + parseEmoji(0x2B50) + "</i>";
			}
			return stars;
		},
		isRetired: function() {
			return _.contains(this.get("data").modifiers.permanent, "RETIRED");
		},
		isPercolated: function() {
			return _.contains(this.get("data").modifiers.permanent, "COFFEE_EXIT");
		},
		isForbidden: function() {
			return secretsVisible;
		}
	});
	App.Models.TeamUpdate = Backbone.Model.extend({
		getInGameTime: function(isShort) {
			if(this.get("start") < new Date("2020-08-01T07:13:21.108Z")) {
				return "Before SIBR";
			} else if(this.get("start") > new Date("2021-10-26T00:00:00.000Z")) {
				return "Gamma"
			}
			var thisUpdate = this, foundTime = globalTimes.find(function(time) {
				return thisUpdate.get("start") >= time.get("start") && thisUpdate.get("start") <= time.get("end");
			});
			if(foundTime) {
				return isShort ? foundTime.toDateLabel() : foundTime.toString();
			}
			return this.get("start").toLocaleDateString() + " " + this.get("start").toLocaleTimeString();
		}
	});
	App.Models.TeamUpdatePlayer = Backbone.Model.extend({
		getBattingStars: function() {
			var i, stars = "", rounded = Math.round(this.get("batting") * 10);
			for(i = 0; i < Math.floor(rounded / 2); i++) {
				stars += "<i class='full-star'>" + parseEmoji(0x2B50) + "</i>";
			}
			if(rounded % 2) {
				stars += "<i class='half-star'>" + parseEmoji(0x2B50) + "</i>";
			}
			return stars;
		},
		getPitchingStars: function() {
			var i, stars = "", rounded = Math.round(this.get("pitching") * 10);
			for(i = 0; i < Math.floor(rounded / 2); i++) {
				stars += "<i class='full-star'>" + parseEmoji(0x2B50) + "</i>";
			}
			if(rounded % 2) {
				stars += "<i class='half-star'>" + parseEmoji(0x2B50) + "</i>";
			}
			return stars;
		},
		getCombinedStars: function() {
			return Math.round(50 * (this.get("batting") + this.get("pitching") + this.get("baserunning") + this.get("defense"))) / 10;
		}
	});
	App.Models.StadiumUpdate = Backbone.Model.extend({
		emoji: parseEmoji,
		getModifier: getModifier,
		getStatProgress: function(stat) {
			var statPercent = this.get("data")[stat] * 100, progress = "<div class='stadium-stat-value " + stat + "' style='margin-left:";
			if(statPercent > 51) {
				progress += "50%;border-radius:0 5px 5px 0;width:" + (statPercent - 50);
			} else if(statPercent < 49) {
				progress += statPercent + "%;border-radius:5px 0 0 5px;width:" + (50 - statPercent);
			} else {
				progress += "49.5%;border-radius:5px;width:1";
			}
			progress += "%'></div>";
			return progress;
		},
		getInGameTime: function(isShort) {
			if(this.get("start") < new Date("2020-08-01T07:13:21.108Z")) {
				return "Before SIBR";
			} else if(this.get("start") > new Date("2021-10-26T00:00:00.000Z")) {
				return "Gamma"
			}
			var thisUpdate = this, foundTime = globalTimes.find(function(time) {
				return thisUpdate.get("start") >= time.get("start") && thisUpdate.get("start") <= time.get("end");
			});
			if(foundTime) {
				return isShort ? foundTime.toDateLabel() : foundTime.toString();
			}
			return this.get("start").toLocaleDateString() + " " + this.get("start").toLocaleTimeString();
		},
		isForbidden: function() {
			return secretsVisible;
		}
	});
	App.Models.Stadium = Backbone.Model.extend({
		filthiness: function() {
			if(this.get("filthiness") < 0.25) {
				return "Getting Uncomfortable";
			} else if(this.get("filthiness") < 0.5) {
				return "Uncomfortable";
			} else if(this.get("filthiness") < 0.75) {
				return "Kind of Filthy";
			} else {
				return "Absolutely Filthy";
			}
		},
		hype: function() {
			if(this.get("hype") < 0.25) {
				return "Pedestrian";
			} else if(this.get("hype") < 0.5) {
				return "Minor";
			} else if(this.get("hype") < 0.75) {
				return "Dope";
			} else if(this.get("hype") < 0.99) {
				return "Major";
			} else {
				return "Peak";
			}
		},
		luxuriousness: function() {
			if(this.get("luxuriousness") < 0.25) {
				return "Low";
			} else if(this.get("luxuriousness") < 0.5) {
				return "Medium";
			} else if(this.get("luxuriousness") > 0.75) {
				return "High";
			} else {
				return "Very High";
			}
		},
		prefab: function() {
			switch(this.get("model")) {
				case 0:
					return "Palermo";
				case 1:
					return "Silverada";
				case 2:
					return "Douglas";
				case 3:
					return "Hillcrest";
				case 4:
					return "Twede";
				case 5:
					return "Rodeo";
				case 6:
					return "Loge";
				case 7:
					return "Pine";
				case 8:
					return "Boreal";
				default:
					return "None";
			}
		},
		improvements: function() {
			return _.pick(this.get("renoLog"), ["light_switch_toggle"]);
		},
		weather: function() {
			return _.map(this.get("weather"), function(modifier, index) {
				var weatherName = weathers ? weathers[index].name : index;
				for(var i = 0; i < modifier; i++) {
					weatherName += "+";
				}
				return weatherName;
			});
		}
	});
	App.Models.Item = Backbone.Model.extend({
		getAggregateAdjustments: function() {
			var stats = ["tragicness", "buoyancy", "thwackability", "moxie", "divinity", "musclitude", "patheticism", "martyrdom", "cinnamon", "baseThirst", "laserlikeness", "continuation", "indulgence", "groundFriction", "shakespearianism", "suppression", "unthwackability", "coldness", "overpowerment", "ruthlessness", "pressurization", "omniscience", "tenaciousness", "watchfulness", "anticapitalism", "chasiness"], adjustments = {};
			_.chain([this.get("prePrefix"), this.get("postPrefix"), this.get("root"), this.get("suffix")])
				.union(this.get("prefixes"))
				.compact()
				.each(function(affix) {
					_.each(affix.adjustments, function(adjustment) {
						if(adjustment.type === 1) {
							var statName = stats[adjustment.stat];
							if(!adjustments.hasOwnProperty(statName)) {
								adjustments[statName] = 0;
							}
							adjustments[statName] += adjustment.value;
						}
					});
				});
			return adjustments;
		},
		getEmoji: function() {
			if(this.get("durability") < -1) {
				return "0x1F3CF";
			}
			if(this.get("durability") > 0 && this.get("health") < 1) {
				return "0x274C";
			}
			switch(this.get("root").name) {
				case "Base":
					return "0x1F539";
				case "Bat":
					return "0x1F3CF";
				case "Board":
					return "0x1F6F9";
				case "Broom":
					return "0x1F9F9";
				case "Cannon":
					return "0x1F52B";
				case "Cap":
					return "0x1F9E2";
				case "Cape":
					return "0x1F9E3";
				case "Chair":
					return "0x1FA91";
				case "Egg":
					return "0x1F95A";
				case "Field":
					return "0x1F535";
				case "Glove":
					return "0x1F9E4";
				case "Helmet":
					return "0x1FA96";
				case "Jacket":
					return "0x1F9E5";
				case "Jersey":
					return "0x1F455";
				case "Necklace":
					return "0x1F4FF";
				case "Phone":
					return "0x260E";
				case "Pillow":
					return "0x1F411";
				case "Potion":
					return "0x2697";
				case "Quill":
					return "0x1FAB6";
				case "Ring":
					return "0x1F48D";
				case "Socks":
					return "0x1F9E6";
				case "Shoes":
					return "0x1F45F";
				case "Sunglasses":
					return "0x1F576";
				default:
					return "0x2753";
			}
		}
	});
	//-- END MODELS --
	
	//-- BEGIN COLLECTIONS --
	App.Collections.TimeMap = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v2/versions",
		model: App.Models.Time,
		fetchPage: function(count, next, success) {
			this.fetch({
				reset: !next,
				remove: !next,
				data: {
					type: "sim",
					order: "asc",
					count: count,
					page: next
				},
				success: success,
				error: console.log
			});
		},
		parse: function(data) {
			return _.map(data.items, function(item) {
				return {
					id: item.hash,
					season: item.data.season + 1,
					day: item.data.day + 1,
					phase: item.data.phase,
					tournament: item.data.tournament,
					tournamentRound: item.data.playoffRound || item.data.tournamentRound || -1,
					title: item.data.eraTitle,
					subtitle: item.data.subEraTitle,
					start: new Date(item.validFrom),
					end: item.validTo ? new Date(item.validTo) : new Date()
				}
			});
		}
	})
	App.Collections.Times = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v1/time/map",
		model: App.Models.Time,
		parse: function(data) {
			return _.map(data.data, function(time) {
				return {
					type: time.type,
					season: time.season + 1,
					day: time.day + 1,
					tournament: time.tournament,
					start: new Date(time.startTime),
					end: time.endTime ? new Date(time.endTime) : new Date()
				};
			});
		}
	});
	App.Collections.Teams = Backbone.Collection.extend({
		url: "https://api.sibr.dev/corsmechanics/api.blaseball.com/database/allTeams",
		model: App.Models.Team,
		emoji: parseEmoji,
		isLightMode: function() {
			return lightMode;
		}
	});
	App.Collections.Tributes = Backbone.Collection.extend({
		url: "https://api.sibr.dev/corsmechanics/api.blaseball.com/api/getTribute",
		model: App.Models.PlayerId,
		parse: function(data) {
			return data.players;
		}
	});
	App.Collections.Stars = Backbone.Collection.extend({
		url: "https://api.sibr.dev/corsmechanics/api.blaseball.com/api/getRisingStars",
		model: App.Models.PlayerId,
		parse: function(data) {
			return _.map(data.stars, function(id) {
				return { "playerId": id };
			});
		}
	});
	App.Collections.Vault = Backbone.Collection.extend({
		url: "https://api.sibr.dev/corsmechanics/api.blaseball.com/database/vault",
		model: App.Models.PlayerId,
		parse: function(data) {
			return _.map(data.legendaryPlayers, function(id) {
				return { "playerId": id };
			});
		}
	});
	App.Collections.Players = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v2/entities",
		model: App.Models.Player,
		fetchPage: function(count, next, success) {
			this.fetch({
				reset: !next,
				remove: !next,
				data: {
					type: "player",
					order: "asc",
					count: count,
					page: next
				},
				success: success,
				error: console.log
			});
		},
		parse: function(data) {
			return _.chain(data.items).map(function(player) {
				if(player.id == "bc4187fa-459a-4c06-bbf2-4e0e013d27ce") {
					player.data.name = "Original Sixpack Dogwalker";
				}
				return player.data;
			}).sortBy(function(player) {
				var name = !_.isEmpty(player.state) & _.has(player.state, "unscatteredName") ? player.state.unscatteredName : player.name, matcher = name.match(/^.+\s([MDCLXVI]+)$/);
				if(matcher) {
					name = name.replace(matcher[1], convertRomanNumerals(matcher[1]));
				}
				return name;
			}).value();
		}
	});
	App.Collections.Updates = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v2/versions",
		model: App.Models.Update,
		fetchPage: function(id, count, next, success) {
			this.fetch({
				reset: !next,
				remove: !next,
				data: {
					type: "player",
					id: id,
					count: count,
					page: next
				},
				success: success,
				error: console.log
			});
		},
		parse: function(data) {
			return _.map(data.items, function(update) {
				return {
					id: update.hash,
					data: formatPlayerData(update.data),
					start: new Date(update.validFrom),
					end: new Date(update.validTo),
					raw: update.data,
					changes: []
				};
			});
		},
		filterData: function() {
			var thisCollection = this;
			this.sortBy(function(m, n) {
				return m.start - n.start;
			});
			this.forEach(function(model, index) {
				if(index == 0) {
					model.get("changes").push("first seen");
				} else {
					_.each(model.get("data"), function(value, attribute) {
						var prevData = thisCollection.at(index - 1).get("data");
						switch(attribute) {
							case "canonical":
							case "id":
								break;
							case "modifiers":
								var prevMods = prevData.modifiers;
								if(prevMods.item.join(",") != value.item.join(",")) {
									_.each(_.difference(prevMods.item, value.item), function(modifier) {
										model.get("changes").push("-" + modifier.replace(/\_/g, " ").toLowerCase());
									});
									_.each(_.difference(value.item, prevMods.item), function(modifier) {
										model.get("changes").push("+" + modifier.replace(/\_/g, " ").toLowerCase());
									});
								}
								if(prevMods.permanent.join(",") != value.permanent.join(",")) {
									_.each(_.difference(prevMods.permanent, value.permanent), function(modifier) {
										model.get("changes").push("-" + modifier.replace(/\_/g, " ").toLowerCase());
									});
									_.each(_.difference(value.permanent, prevMods.permanent), function(modifier) {
										model.get("changes").push("+" + modifier.replace(/\_/g, " ").toLowerCase());
									});
								}
								if(prevMods.seasonal.join(",") != value.seasonal.join(",")) {
									_.each(_.difference(prevMods.seasonal, value.seasonal), function(modifier) {
										model.get("changes").push("-" + modifier.replace(/\_/g, " ").toLowerCase());
									});
									_.each(_.difference(value.seasonal, prevMods.seasonal), function(modifier) {
										model.get("changes").push("+" + modifier.replace(/\_/g, " ").toLowerCase());
									});
								}
								if(model.get("data").deceased && prevMods.game.join(",") != value.game.join(",")) {
									_.each(_.difference(prevMods.game, value.game), function(modifier) {
										model.get("changes").push("-" + modifier.replace(/\_/g, " ").toLowerCase());
									});
									_.each(_.difference(value.game, prevMods.game), function(modifier) {
										model.get("changes").push("+" + modifier.replace(/\_/g, " ").toLowerCase());
									});
								}
								break;
							case "items":
								if(_.pluck(prevData.items, "id").join(",") != _.pluck(value, "id").join(",")) {
									model.get("changes").push("items");
								} else if(prevData.items.length > 0 && value.length > 0) {
									var durabilities = {};
									_.each(prevData.items, function(item) {
										durabilities[item.id] = item.get("health");
									});
									_.each(value, function(item) {
										if(durabilities.hasOwnProperty(item.id) && durabilities[item.id] != item.get("health")) {
											model.get("changes").push("durability");
											return;
										}
									});
								}
								break;
							case "teams":
								var prevTeams = prevData.teams;
								if(prevTeams.league != value.league) {
									model.get("changes").push("team");
								}
								if(prevTeams.tournament != value.tournament) {
									model.get("changes").push("tournament");
								}
								break;
							case "vibes":
								var prevVibes = prevData.vibes;
								if(prevVibes) {
									if(prevVibes.frequency > value.frequency) {
										model.get("changes").push("shorter vibes");
									} else if(prevVibes.frequency < value.frequency) {
										model.get("changes").push("longer vibes");
									}
									if(prevVibes.minimum != value.minimum) {
										model.get("changes").push("minimum vibes");
									}
									if(prevVibes.maximum != value.maximum) {
										model.get("changes").push("maximum vibes");
									}
								}
								break;
							default:
								if(prevData[attribute] != value) {
									model.get("changes").push(attribute);
								}
						}
						model.get("changes").sort();
					});
				}
			});
			this.set(this.filter(function(model) {
				return model.get("changes").length;
			}));
		},
		emoji: parseEmoji
	});
	App.Collections.TeamUpdates = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v2/versions",
		model: App.Models.TeamUpdate,
		fetchPage: function(id, count, next, success) {
			this.fetch({
				reset: !next,
				remove: !next,
				data: {
					type: "team",
					id: id,
					count: count,
					page: next
				},
				success: success,
				error: console.log
			});
		},
		parse: function(data) {
			return _.map(data.items, function(update) {
				return {
					id: update.hash,
					data: formatTeamData(update.data),
					start: new Date(update.validFrom),
					end: new Date(update.validTo),
					raw: update.data,
					changes: []
				};
			});
		},
		filterData: function() {
			var lastChange, collectionLength = this.length;
			this.sortBy(function(m, n) {
				return m.start - n.start;
			});
			this.forEach(function(model, index) {
				if(index == 0) {
					model.get("changes").push("first seen");
					lastChange = model;
				} else {
					if(model.get("start").getTime() - lastChange.get("start").getTime() > 6000 || index + 1 == collectionLength) {
						_.each(model.get("data"), function(value, attribute) {
							switch(attribute) {
								case "id":
								case "level":
									break;
								case "modifiers":
									var prevMods = lastChange.get("data").modifiers;
									if(prevMods.join(",") != value.join(",")) {
										_.each(_.difference(prevMods, value), function(modifier) {
											model.get("changes").push("-" + modifier.replace(/\_/g, " ").toLowerCase());
										});
										_.each(_.difference(value, prevMods), function(modifier) {
											model.get("changes").push("+" + modifier.replace(/\_/g, " ").toLowerCase());
										});
									}
									break;
								case "lineup":
								case "rotation":
								case "shadows":
									if(lastChange.get("data")[attribute].join(",") != value.join(",")) {
										model.get("changes").push(attribute);
									}
									break;
								default:
									if(lastChange.get("data")[attribute] != value) {
										model.get("changes").push(attribute);
									}
							}
						});
					}
					model.get("changes").sort();
					if(model.get("changes").length) {
						lastChange = model;
					}
				}
			});
			this.set(this.filter(function(model) {
				return model.get("changes").length;
			}));
		}
	});
	App.Collections.TeamUpdatePlayers = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v2/versions",
		model: App.Models.TeamUpdatePlayer,
		fetchPage: function(id, count, next, success) {
			this.fetch({
				reset: !next,
				remove: !next,
				data: {
					type: "player",
					order: "asc",
					id: id,
					count: count,
					page: next
				},
				success: success,
				error: console.log
			});
		},
		parse: function(data) {
			return _.map(data.items, function(update) {
				return formatPlayerData(update.data);
			});
		}
	});
	App.Collections.StadiumUpdates = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v2/versions",
		model: App.Models.StadiumUpdate,
		fetchPage: function(id, count, next, success) {
			this.fetch({
				reset: !next,
				remove: !next,
				data: {
					type: "stadium",
					order: "asc",
					id: id,
					count: count,
					page: next
				},
				success: success,
				error: console.log
			});
		},
		parse: function(data) {
			return _.map(data.items, function(update) {
				return {
					id: update.hash,
					data: formatStadiumData(update.data),
					start: new Date(update.validFrom),
					end: new Date(update.validTo),
					raw: update.data,
					changes: []
				};
			});
		},
		filterData: function() {
			var lastChange;
			this.sortBy(function(m, n) {
				return m.start - n.start;
			});
			this.forEach(function(model, index) {
				if(index == 0) {
					model.get("changes").push("first seen");
					lastChange = model;
				} else {
					if(model.get("start").getTime() - lastChange.get("start").getTime() > 6000) {
						_.each(model.get("data"), function(value, attribute) {
							switch(attribute) {
								case "id":
								case "hype":
									break;
								case "improvements":
									var prevImps = lastChange.get("data").improvements;
									if(!_.isEqual(prevImps, value)) {
										_.each(value, function(state, key) {
											if(_.get(prevImps, key, undefined) != state) {
												if(_.get(prevImps, key, undefined) == undefined) {
													model.get("changes").push("installed " + key.replace(/\_/g, " "));
												} else if(state) {
													model.get("changes").push(key.replace(/\_/g, " ") + "d on");
												} else {
													model.get("changes").push(key.replace(/\_/g, " ") + "d off");
												}
											}
										});
										_.each(prevImps, function(state, key) {
											if(_.get(value, key, undefined) == undefined) {
												model.get("changes").push("removed " + key.replace(/\_/g, " "));
											}
										});
									}
									break;
								case "modifiers":
									var prevMods = lastChange.get("data").modifiers;
									if(prevMods.join(",") != value.join(",")) {
										_.each(_.difference(prevMods, value), function(modifier) {
											model.get("changes").push("-" + modifier.replace(/\_/g, " ").toLowerCase());
										});
										_.each(_.difference(value, prevMods), function(modifier) {
											model.get("changes").push("+" + modifier.replace(/\_/g, " ").toLowerCase());
										});
									}
									break;
								case "weather":
									var prevWeather = lastChange.get("data").weather;
									if(prevWeather.join(",") != value.join(",")) {
										_.each(_.difference(value, prevWeather), function(weather) {
											model.get("changes").push(weather.toLowerCase());
										});
									}
									break;
								default:
									if(lastChange.get("data")[attribute] != value) {
										model.get("changes").push(attribute);
									}
							}
						});
					}
					model.get("changes").sort();
					if(model.get("changes").length) {
						lastChange = model;
					}
				}
			});
			this.set(this.filter(function(model) {
				return model.get("changes").length;
			}));
		}
	});
	//-- END COLLECTIONS --
	
	//-- BEGIN VIEWS --
	App.Views.Nav = Backbone.View.extend({
		template: _.template($("#template-nav").html()),
		el: "nav",
		initialize: function() {
			this.render();
		},
		render: function() {
			var groups = this.collection.groupBy(function(team) { return team.type(); });
			this.$el.html(this.template({
				isLightMode: function() { return lightMode; },
				emoji: parseEmoji,
				special: groups.special,
				groups: {
					"Short Circuits": groups.gamma9,
					"ILB": groups.beta,
					"Library": groups.historical,
					"Coffee Cup": _.union(groups.coffee, groups.coffee2),
					"Gamma8": groups.gamma8,
					"Gamma4": groups.gamma4,
					"Doomed Universe": groups.gamma2,
					"Lost Reality": groups.gamma3,
					"Abandoned Gamma5": groups.gamma5,
					"Abandoned Gamma6": groups.gamma6,
					"Abandoned Gamma7": groups.gamma7,
					"Other": groups.unknown
				}
			}));
		},
		events: {
			"input .team-selector input[type=search]": "searchTeams",
			"click a": "selectTeam",
			"focus .team-selector input[type=search]": "openSelector",
			"blur .team-selector input[type=search]": "closeSelector"
		},
		searchTeams: function(e) {
			var searchValue = $(e.currentTarget).val();
			if(searchValue) {
				this.collection.set(globalTeams.filter(function(team) {
					return team.type() == "special" || _.any([team.canonicalName(), team.get("shorthand"), team.get("location")], function(searchable) { return removeDiacritics(searchable.toLowerCase()).indexOf(removeDiacritics(searchValue.toLowerCase())) > -1; });
				}));
			} else {
				this.collection.set(globalTeams.toJSON());
			}
			this.render();
			this.$el.find(".team-selector input[type=search]").val(searchValue);
			this.$el.find(".team-selector input[type=search]").focus();
		},
		selectTeam: function(e) {
			e.preventDefault();
			activeRouter.navigate(e.currentTarget.href.split("#")[1], { trigger: true });
			this.$el.find(".team-selector").removeClass("active");
		},
		openSelector: function(e) {
			e.preventDefault();
			this.$el.find(".team-selector").addClass("active");
		},
		closeSelector: function(e) {
			e.preventDefault();
			if(!isMobile() && !$(e.relatedTarget).parents(".team-selector").length) {
				this.$el.find(".team-selector").removeClass("active");
			}
		}
	});
	App.Views.Team = Backbone.View.extend({
		template: _.template($("#template-team").html()),
		el: "main",
		initialize: function() {
			var thisView = this, thisCollection;
			switch(this.model.id) {
				case "tributes":
					thisCollection = new App.Collections.Tributes();
					break;
				case "stars":
					thisCollection = new App.Collections.Stars();
					break;
				case "vault":
					thisCollection = new App.Collections.Vault();
					break;
			}
			if(thisCollection) {
				thisCollection.fetch({
					success: function() {
						thisView.model.set("players", new App.Collections.Players(thisCollection.chain().map(function(data) {
							return globalPlayers.findWhere({ id: data.get("playerId") });
						}).compact().value()));
						thisView.render();
					},
					error: console.log
				});
			} else {
				if(this.model.id == "7fcb63bc-11f2-40b9-b465-f1d458692a63") {
					this.model.set("percolated", [
						"9c14cb0c-79ab-4b94-9ae3-c8de1c587e55", // GM
						"afdbd837-7fc8-4c97-ac31-636950c2b3e4", // Blaseball Surgeon
						"1a53768b-1ec1-4646-8417-dd58b9849bd7", // Ball Clark
						"a13f67d5-22eb-4ee9-8b67-893b21acd87b", // Cedrissimo Sugar
						"00ca40af-a8df-4519-af9a-beaf93ffc122", // Eli Winner
						"82d5e79d-e125-4460-b1fa-d046ad7739e0", // Changeup Liu
						"37bdafdf-f213-4718-8200-c123fca39ff5", // Slam Rosenthal
						"555b0a07-a3e0-41bc-b3db-ca8f520857bc", // Oops All Keepers
						"12f3a18d-cc63-480d-b2ad-f0d89c1c4562", // The Murph
						"cacee0b8-50fc-4df4-96ea-089a3d501810", // Nlikki Hart
						"9e39f808-ff70-4232-8a8c-28085227155f", // Bugcatcher Roland
						"f6d3c134-e3ee-40a1-bd4d-095347444129"/*, // Parker MacMillan IIII 
						"74b0974a-f827-4934-9dd0-2020728bd4cc", // Stealix Kramer
						"3bf8713b-8886-4fc4-983e-e2c72bef7b95", // Stephen Shelled
						"2aee32f9-a5bc-4f95-932c-cf7492d09374", // Cory Thirteen
						"b357fbf4-533e-4f2c-8616-a576e9954795" // Cat Inning
						"a11242ae-936a-46b4-9101-be2cabafeed4" // Electric Kettle*/
					]);
				}
				if(this.model.id == "all") {
					this.model.set("players", globalPlayers);
				} else {
					this.model.set("players", new App.Collections.Players(_.chain([]).union(this.model.get("lineup"), this.model.get("rotation"), this.model.get("shadows"), this.model.get("percolated")).map(function(id) { return globalPlayers.findWhere({ id: id }); }).compact().value()));
				}
				this.render();
			}
		},
		render: function() {
			this.model.unset("filtered");
			this.$el.html(this.template(this.model));
		},
		events: {
			"input .team-player-search input[type=search]": "searchPlayer",
			"click .team-players a:not(.player-link)": "selectPlayer",
			"click a[data-toggle-knowledge]": "toggleKnowledge",
			"click a[data-toggle-spacing]": "toggleSpacing",
			"click a[data-toggle-lights]": "toggleLights"
		},
		searchPlayer: function(e) {
			var searchValue = $(e.currentTarget).val();
			if(searchValue) {
				var PlayersCollection = new App.Collections.Players(this.model.get("players").filter(function(model) {
					return removeDiacritics(model.canonicalName().toLowerCase()).indexOf(removeDiacritics(searchValue.toLowerCase())) > -1;
				}));
				this.model.set("filtered", PlayersCollection);
			} else {
				this.model.unset("filtered");
			}
			this.$el.find(".team-players").replaceWith($(this.template(this.model)).find(".team-players"));
		},
		selectPlayer: function(e) {
			e.preventDefault();
			activeRouter.navigate(e.currentTarget.href.split("#")[1], { trigger: true });
		},
		toggleKnowledge: function(e) {
			e.preventDefault();
			secretsVisible = !$(e.currentTarget).data("toggle-knowledge");
			$(e.currentTarget).data("toggle-knowledge", secretsVisible);
			$("#root").toggleClass("secrets", secretsVisible);
			$(e.currentTarget).html("Forbidden Knowledge " + (secretsVisible ? "Visible" : "Hidden"));
			if(updatesView) {
				updatesView.render();
			}
			if(historyView) {
				historyView.render();
			}
			if(stadiumView) {
				stadiumView.render();
			}
			if(localStorageExists()) {
				localStorage.setItem("secretsState", secretsVisible);
			}
			gtag('event', 'toggle_forbidden_knowledge');
		},
		toggleSpacing: function(e) {
			e.preventDefault();
			evenlySpaced = !$(e.currentTarget).data("toggle-spacing");
			$(e.currentTarget).data("toggle-spacing", evenlySpaced);
			$(e.currentTarget).html("Spaced " + (evenlySpaced ? "Evenly" : "By Real Time"));
			if(updatesView) {
				updatesView.render();
			}
			if(historyView) {
				historyView.render();
			}
			if(stadiumView) {
				stadiumView.render();
			}
			if(localStorageExists()) {
				localStorage.setItem("evenSpacingState", evenlySpaced);
			}
			gtag('event', 'toggle_spacing');
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
			if(updatesView) {
				updatesView.render();
			}
			if(historyView) {
				historyView.render();
			}
			if(stadiumView) {
				stadiumView.render();
			}
			if(localStorageExists()) {
				localStorage.setItem("lightModeState", lightMode);
			}
			gtag('event', 'toggle_lights');
		}
	});
	App.Views.Updates = Backbone.View.extend({
		template: _.template($("#template-chart").html()),
		el: "section.chart",
		initialize: function() {
			if(updates[this.id]) {
				this.collection = updates[this.id];
				this.render();
			} else {
				var thisView = this, count = 1000,
					fetchSuccess = function(collection, response) {
						if(response.nextPage) {
							collection.fetchPage(thisView.id, count, response.nextPage, fetchSuccess);
						} else {
							collection.filterData();
							updates[thisView.id] = collection;
							thisView.render();
						}
					};
				this.collection.fetchPage(this.id, count, null, fetchSuccess);
			}
		},
		render: function() {
			var height = $("main").innerHeight(),
				width = isMobile() ? $(window).width() : $("main").width() - 320,
				titleOffset = 60,
				padding = 20,
				margin = 40,
				radius = 4,
				attributes = ["batting", "baserunning", "defense", "pitching"],
				changes = this.collection.filter(function(update) {
					if(secretsVisible) {
						return update.get("changes").length;
					} else {
						return _.without(update.get("changes"), "fingers").length;
					}
				}),
				ratings = _.reduce(changes, function(c, d) {
					return _.union(c, _.map(attributes, function(attribute) { return d.get("data")[attribute]; }));
				}, []),
				svg = { 
					height: height,
					width: width,
					innerHeight: height - margin - titleOffset,
					innerWidth: width - 2 * margin,
					title: _.last(changes).get("data").canonical,
					titleOffset: titleOffset,
					padding: padding,
					margin: margin,
					radius: radius,
					labels: {
						stars: [],
						dates: []
					},
					plots: {}
				}, 
				xMin = _.first(changes).get("start").getTime(), 
				xMax =  _.last(changes).get("start").getTime(), 
				yMin =  _.min(ratings), 
				yMax = _.max(ratings),
				dateLabels = [];
			
			for(var i = Math.ceil(yMin * 10); i < yMax * 10; i++) {
				svg.labels.stars.push({
					num: i / 2,
					pos: (svg.innerHeight - svg.margin - svg.padding) * (1 - (i / 10 - yMin) / (yMax - yMin)) + svg.padding + svg.titleOffset
				});
			}
			
			_.each(changes, function(update, index) {
				var xPos = xMin == xMax ? 0.5 : (update.get("start").getTime() - xMin) / (xMax - xMin),
					xEven = changes.length < 2 ? 0.5 : index / (changes.length - 1),
					xAbsolute = convertRelativeToAbsoluteX(evenlySpaced ? xEven : xPos, svg),
					yRange = yMax - yMin,
					dateText = update.getInGameTime(true),
					dateTextLength = calculateSvgTextWidth(dateText, "axis-date-label") / 2 + 2,
					dateLabel,
					prevLabels = _.last(dateLabels, 2);
				
				_.each(attributes, function(attribute) {
					if(!svg.plots.hasOwnProperty(attribute)) {
						svg.plots[attribute] = { points: [], paths: [] };
					}
					svg.plots[attribute].points.push({
						id: update.id, 
						x: xAbsolute, 
						y: convertRelativeToAbsoluteY((update.get("data")[attribute] - yMin) / yRange, svg)
					});
				});
				dateLabel = {
					above: dateLabels.length % 2,
					x: xAbsolute,
					y: convertRelativeToAbsoluteY(0, svg),
					start: xAbsolute - dateTextLength,
					end: xAbsolute + dateTextLength,
					date: dateText,
					emojis: [],
					show: false
				};
				if(prevLabels.length < 2 ||(!_.chain(prevLabels).pluck("date").contains(dateText).value() && dateLabel.start > prevLabels[0].end)) {
					dateLabels.push(dateLabel);
					dateLabel.show = true;
				}
				if(_.contains(update.get("changes"), "deceased")) {
					dateLabel.emojis.push(update.get("data").deceased ? 0x1F525 : 0x1F991);
				}
				if(_.contains(update.get("changes"), "+retired")) {
					dateLabel.emojis.push(0x1F634);
				}
				if(_.contains(update.get("changes"), "+coffee exit")) {
					dateLabel.emojis.push(0x2615);
				}
				if(_.contains(update.get("changes"), "team")) {
					dateLabel.emojis.push(0x1F3A4);
				}
				if(_.contains(update.get("changes"), "items")) {
					dateLabel.emojis.push(0x1F3CF);
				}
				if(_.contains(update.get("changes"), "+alternate")) {
					dateLabel.emojis.push(0x1F465);
				}
				if(_.contains(update.get("changes"), "+shelled")) {
					dateLabel.emojis.push(0x1F95C);
				}
				if(_.contains(update.get("changes"), "-shelled")) {
					dateLabel.emojis.push(0x1F423);
				}
				if(_.contains(update.get("changes"), "+static")) {
					dateLabel.emojis.push(0x1F4AC);
				}
				if(_.contains(update.get("changes"), "+redacted")) {
					dateLabel.emojis.push(0x1F4C1);
				}
				if(_.contains(update.get("changes"), "+attractor")) {
					dateLabel.emojis.push(0x1F9F2);
				}
				if(_.contains(update.get("changes"), "+legendary")) {
					dateLabel.emojis.push(0x1F3C6);
				}
				svg.labels.dates.push(dateLabel);
			});
			
			_.each(svg.plots, function(plot) {
				_.each(plot.points, function(point, index) {
					var prevPoint, nextPoint;
					if(index > 0) {
						prevPoint = plot.points[index - 1];
					}
					if(index < plot.points.length - 1) {
						nextPoint = plot.points[index + 1]
					}
					if(prevPoint && nextPoint) {
						plot.paths.push({
							id: point.id,
							path: getPath(point.x, prevPoint.y, nextPoint.x, point.y, 1)
						});
					} else if(prevPoint) {
						plot.paths.push({
							id: point.id,
							path: getPath(point.x, prevPoint.y, point.x, point.y, 1)
						});
					} else if(nextPoint) {
						plot.paths.push({
							id: point.id,
							path: getPath(point.x, point.y, nextPoint.x, point.y, 1)
						});
					}
				});
			});
			
			this.$el.html(this.template({
				emojiSvg: function(emoji) {
					return $(parseEmoji(emoji, { "folder": "svg", "ext": ".svg" })).attr("src");
				},
				svg: svg
			}));
		},
		events: {
			"mouseenter circle, path": "showPlayerCard",
			"mouseleave circle, path": "hidePlayerCard"
		},
		showPlayerCard: function(e) {
			var id = $(e.currentTarget).data("id"), leftOffset = e.clientX + 20, topOffset;
			if(id) {
				$("[data-id=" + id + "]").addClass("active");
				$("main").append(_.template($("#template-card").html())(updates[activePlayer.id].findWhere({ id: id })));
				if(isMobile()) {
					$(".card").css({ left: 20, top: $("svg").height() + 20 });
				} else {
					if(e.clientY + $(".card").outerHeight(true) > $(window).outerHeight()) {
						topOffset = $(window).outerHeight() - $(".card").outerHeight(true) - 15;
					} else {
						topOffset = ($(window).outerHeight() - $(".card").outerHeight(true)) / 2;
					}
					if(leftOffset + $(".card").outerWidth(true) > $(window).outerWidth()) {
						if(leftOffset - $(".card").outerWidth(true) - 40 < 0) {
							
						} else {
							leftOffset = e.clientX - $(".card").outerWidth(true) - 20;
						}
					}
					$(".card").css({ left: leftOffset, top: topOffset });
				}
			}
		},
		hidePlayerCard: function(e) {
			var id = $(e.currentTarget).data("id");
			if(id) {
				$("[data-id=" + id + "]").removeClass("active");
				$(".card").remove();
			}
		}
	});
	App.Views.AdvancedUpdates = App.Views.Updates.extend({
		template: _.template($("#template-advanced").html()),
		el: "section.chart",
		render: function() {
			this.$el.html(this.template(this.collection));
			this.resize();
		},
		resize: function() {
			this.$el.find(".advanced").css({
				height: $("main").innerHeight() - this.$el.find("h1").height(),
				width: isMobile() ? $(window).width() : $("main").width() - 320
			});
		},
		events: {
			"click th.player-timestamp": "sortByTimestamp"
		},
		sortByTimestamp: function(e) {
			var scroll = { x: this.$el.find(".advanced").scrollLeft(), y: this.$el.find(".advanced").scrollTop() },
				direction = $(e.currentTarget).data("direction") == "asc" ? "desc" : "asc";
			this.collection.set(this.collection.toJSON().reverse());
			this.render();
			this.$el.find("th.player-timestamp").attr("data-direction", direction);
			this.$el.find(".advanced").scrollLeft(scroll.x);
			this.$el.find(".advanced").scrollTop(scroll.y);
		}
	});
	App.Views.TeamHistory = Backbone.View.extend({
		template: _.template($("#template-history-chart").html()),
		el: "section.chart",
		initialize: function() {
			if(updates[this.id]) {
				this.collection = updates[this.id];
				this.render();
			} else {
				var thisView = this, count = 1000,
					fetchSuccess = function(collection, response) {
						if(response.nextPage) {
							collection.fetchPage(thisView.id, count, response.nextPage, fetchSuccess);
						} else {
							collection.filterData();
							updates[thisView.id] = collection;
							thisView.render();
						}
					};
				this.collection.fetchPage(this.id, count, null, fetchSuccess);
			}
		},
		loadPlayer: function(id, time, callback) {
			new App.Collections.TeamUpdatePlayers().fetch({
				data: {
					type: "player",
					id: id,
					after: time.toISOString(),
					count: 1
				},
				success: function(collection) {
					if(callback) {
						callback(collection);
					}
				},
				error: console.log
			});
		},
		render: function() {
			var height = $("main").innerHeight(),
				width = isMobile() ? $(window).width() : $("main").width() - 320,
				titleOffset = 60,
				padding = 20,
				margin = 40,
				radius = 4,
				attributes = ["lineup", "rotation", "shadows"],
				collectionSize = this.collection.size(),
				numPlayers = this.collection.reduce(function(c, d) {
					return _.union(c, _.map(attributes, function(attribute) { return _.get(d.get("data"), attribute, []).length; }));
				}, []),
				svg = { 
					height: height,
					width: width,
					innerHeight: height - margin - titleOffset,
					innerWidth: width - 2 * margin,
					title: activeTeam.canonicalName(),
					titleOffset: titleOffset,
					padding: padding,
					margin: margin,
					radius: radius,
					labels: {
						players: [],
						dates: []
					},
					plots: {}
				}, 
				xMin = this.collection.first().get("start").getTime(), 
				xMax =  this.collection.last().get("start").getTime(), 
				yMin =  _.min(numPlayers), 
				yMax = _.max(numPlayers),
				dateLabels = [];
			
			for(var i = yMin; i <= yMax; i++) {
				svg.labels.players.push({
					num: i,
					pos: (svg.innerHeight - svg.margin - svg.padding) * (1 - (i - yMin) / (yMax - yMin)) + svg.padding + svg.titleOffset
				});
			}
			
			this.collection.forEach(function(update, index) {
				var xPos = xMin == xMax ? 0.5 : (update.get("start").getTime() - xMin) / (xMax - xMin),
					xEven = collectionSize < 2 ? 0.5 : index / (collectionSize - 1),
					xAbsolute = convertRelativeToAbsoluteX(evenlySpaced ? xEven : xPos, svg),
					yRange = yMax - yMin,
					dateText = update.getInGameTime(true),
					dateTextLength = calculateSvgTextWidth(dateText, "axis-date-label") / 2 + 2,
					dateLabel,
					prevLabels = _.last(dateLabels, 2);
				
				_.each(attributes, function(attribute) {
					if(!svg.plots.hasOwnProperty(attribute)) {
						svg.plots[attribute] = { points: [], paths: [] };
					}
					svg.plots[attribute].points.push({
						id: update.id, 
						x: xAbsolute, 
						y: convertRelativeToAbsoluteY((_.get(update.get("data"), attribute, []).length - yMin) / yRange, svg)
					});
				});
				dateLabel = {
					above: dateLabels.length % 2,
					x: xAbsolute,
					y: convertRelativeToAbsoluteY(0, svg),
					start: xAbsolute - dateTextLength,
					end: xAbsolute + dateTextLength,
					date: update.getInGameTime(true),
					emojis: [],
					show: false
				};
				if(prevLabels.length < 2 ||(!_.chain(prevLabels).pluck("date").contains(dateText).value() && dateLabel.start > prevLabels[0].end)) {
					dateLabels.push(dateLabel);
					dateLabel.show = true;
				}
				svg.labels.dates.push(dateLabel);
			});
			
			_.each(svg.plots, function(plot) {
				_.each(plot.points, function(point, index) {
					var prevPoint, nextPoint;
					if(index > 0) {
						prevPoint = plot.points[index - 1];
					}
					if(index < plot.points.length - 1) {
						nextPoint = plot.points[index + 1]
					}
					if(prevPoint && nextPoint) {
						plot.paths.push({
							id: point.id,
							path: getPath(point.x, prevPoint.y, nextPoint.x, point.y, 1)
						});
					} else if(prevPoint) {
						plot.paths.push({
							id: point.id,
							path: getPath(point.x, prevPoint.y, point.x, point.y, 1)
						});
					} else if(nextPoint) {
						plot.paths.push({
							id: point.id,
							path: getPath(point.x, point.y, nextPoint.x, point.y, 1)
						});
					}
				});
			});
			
			this.$el.html(this.template({
				emojiSvg: function(emoji) {
					return $(parseEmoji(emoji, { "folder": "svg", "ext": ".svg" })).attr("src");
				},
				svg: svg
			}));
		},
		events: {
			"mouseenter circle, path": "showTeamCard",
			"mouseleave circle, path": "hideTeamCard"
		},
		renderTeamCard: function(id, x, y) {
			var thisView = this, leftOffset = x + 20, topOffset, update = thisView.collection.findWhere({ id: id }), content = _.template($("#template-history-card").html())({ team: activeTeam, model: update, emoji: parseEmoji, getModifier: getModifier, isForbidden: function() { return secretsVisible; } });
			if($(".card").length) {
				$(".card").replaceWith(content);
			} else {
				$("main").append(content);
			}
			if(isMobile()) {
				$(".card").css({ left: 20, top: $("svg").height() + 20 });
			} else {
				if(y + $(".card").outerHeight(true) > $(window).outerHeight()) {
					topOffset = $(window).outerHeight() - $(".card").outerHeight(true) - 15;
				} else {
					topOffset = ($(window).outerHeight() - $(".card").outerHeight(true)) / 2;
				}
				if(leftOffset + $(".card").outerWidth(true) > $(window).outerWidth()) {
					if(leftOffset - $(".card").outerWidth(true) - 40 < 0) {
						
					} else {
						leftOffset = x - $(".card").outerWidth(true) - 20;
					}
				}
				$(".card").css({ left: leftOffset, top: topOffset });
			}
			if(update && (!update.get("players") || !update.get("players").length)) {
				_.each(_.union(update.get("data").lineup, update.get("data").rotation, update.get("data").shadows), function(playerId) {
					thisView.loadPlayer(playerId, update.get("start"), function(collection) {
						if(!collection.length) {
							var foundPlayer = formatPlayerData(activeTeam.get("players").findWhere({ id: playerId }).toJSON());
							if(foundPlayer) {
								collection.add(foundPlayer);
							}
						}
						if(update.get("players") && update.get("players").length) {
							update.get("players").add(collection.toJSON());
						} else {
							update.set("players", collection);
						}
						thisView.renderTeamCard(id, x, y);
					});
				});
			}
		},
		showTeamCard: function(e) {
			var id = $(e.currentTarget).data("id");
			if(id) {
				$(".card").remove();
				$("[data-id=" + id + "]").addClass("active");
				this.renderTeamCard(id, e.clientX, e.clientY);
			}
		},
		hideTeamCard: function(e) {
			var id = $(e.currentTarget).data("id");
			if(id) {
				$("[data-id=" + id + "]").removeClass("active");
				$(".card").remove();
			}
		}
	});
	App.Views.Stadiums = Backbone.View.extend({
		template: _.template($("#template-stadium-chart").html()),
		el: "section.chart",
		initialize: function() {
			if(updates[this.id]) {
				this.collection = updates[this.id];
				this.render();
			} else {
				var thisView = this, count = 1000,
					fetchSuccess = function(collection, response) {
						if(response.nextPage) {
							collection.fetchPage(thisView.id, count, response.nextPage, fetchSuccess);
						} else {
							collection.filterData();
							updates[thisView.id] = collection;
							thisView.render();
						}
					};
				this.collection.fetchPage(this.id, count, null, fetchSuccess);
			}
		},
		render: function() {
			var height = $("main").innerHeight(),
				width = isMobile() ? $(window).width() : $("main").width() - 320,
				titleOffset = 60,
				padding = 20,
				margin = 40,
				radius = 4,
				attributes = ["grandiosity", "fortification", "obtuseness", "ominousness", "inconvenience", "viscosity", "forwardness", "mysticism", "elongation"],
				collectionSize = this.collection.size(),
				ratings = this.collection.reduce(function(c, d) {
					return _.union(c, _.map(attributes, function(attribute) { return d.get("data")[attribute]; })); 
				}, []),
				svg = { 
					height: height,
					width: width,
					innerHeight: height - margin - titleOffset,
					innerWidth: width - 2 * margin,
					title: this.collection.last().get("data").name,
					titleOffset: titleOffset,
					padding: padding,
					margin: margin,
					radius: radius,
					labels: {
						stats: [],
						dates: []
					},
					plots: {}
				}, 
				xMin = this.collection.first().get("start").getTime(), 
				xMax =  this.collection.last().get("start").getTime(),
				yMin =  _.min(ratings), 
				yMax = _.max(ratings),
				dateLabels = [];
			
			for(var i = Math.ceil(yMin * 10); i < yMax * 10; i++) {
				svg.labels.stats.push({
					num: i / 10,
					pos: (svg.innerHeight - svg.margin - svg.padding) * (1 - (i / 10 - yMin) / (yMax - yMin)) + svg.padding + svg.titleOffset
				});
			}
			
			this.collection.forEach(function(update, index) {
				var xPos = xMin == xMax ? 0.5 : (update.get("start").getTime() - xMin) / (xMax - xMin),
					xEven = collectionSize < 2 ? 0.5 : index / (collectionSize - 1),
					xAbsolute = convertRelativeToAbsoluteX(evenlySpaced ? xEven : xPos, svg),
					yRange = yMax - yMin,
					dateText = update.getInGameTime(true),
					dateTextLength = calculateSvgTextWidth(dateText, "axis-date-label") / 2 + 2,
					dateLabel,
					prevLabels = _.last(dateLabels, 2);
				
				_.each(attributes, function(attribute) {
					if(!svg.plots.hasOwnProperty(attribute)) {
						svg.plots[attribute] = { points: [], paths: [] };
					}
					svg.plots[attribute].points.push({
						id: update.id, 
						x: xAbsolute, 
						y: convertRelativeToAbsoluteY((update.get("data")[attribute] - yMin) / yRange, svg)
					});
				});
				dateLabel = {
					above: dateLabels.length % 2,
					x: xAbsolute,
					y: convertRelativeToAbsoluteY(0, svg),
					start: xAbsolute - dateTextLength,
					end: xAbsolute + dateTextLength,
					date: update.getInGameTime(true),
					emojis: [],
					show: false
				};
				if(prevLabels.length < 2 ||(!_.chain(prevLabels).pluck("date").contains(dateText).value() && dateLabel.start > prevLabels[0].end)) {
					dateLabels.push(dateLabel);
					dateLabel.show = true;
				}
				svg.labels.dates.push(dateLabel);
			});
			
			_.each(svg.plots, function(plot) {
				_.each(plot.points, function(point, index) {
					var prevPoint, nextPoint;
					if(index > 0) {
						prevPoint = plot.points[index - 1];
					}
					if(index < plot.points.length - 1) {
						nextPoint = plot.points[index + 1]
					}
					if(prevPoint && nextPoint) {
						plot.paths.push({
							id: point.id,
							path: getPath(point.x, prevPoint.y, nextPoint.x, point.y, 1)
						});
					} else if(prevPoint) {
						plot.paths.push({
							id: point.id,
							path: getPath(point.x, prevPoint.y, point.x, point.y, 1)
						});
					} else if(nextPoint) {
						plot.paths.push({
							id: point.id,
							path: getPath(point.x, point.y, nextPoint.x, point.y, 1)
						});
					}
				});
			});
			
			this.$el.html(this.template({
				emojiSvg: function(emoji) {
					return $(parseEmoji(emoji, { "folder": "svg", "ext": ".svg" })).attr("src");
				},
				svg: svg
			}));
		},
		events: {
			"mouseenter circle, path": "showStadiumCard",
			"mouseleave circle, path": "hideStadiumCard"
		},
		showStadiumCard: function(e) {
			var id = $(e.currentTarget).data("id"), leftOffset = e.clientX + 20, topOffset;
			if(id) {
				$("[data-id=" + id + "]").addClass("active");
				$("main").append(_.template($("#template-stadium-card").html())(this.collection.findWhere({ id: id })));
				if(isMobile()) {
					$(".card").css({ left: 20, top: $("svg").height() + 20 });
				} else {
					if(e.clientY + $(".card").outerHeight(true) > $(window).outerHeight()) {
						topOffset = $(window).outerHeight() - $(".card").outerHeight(true) - 15;
					} else {
						topOffset = ($(window).outerHeight() - $(".card").outerHeight(true)) / 2;
					}
					if(leftOffset + $(".card").outerWidth(true) > $(window).outerWidth()) {
						if(leftOffset - $(".card").outerWidth(true) - 40 < 0) {
							
						} else {
							leftOffset = e.clientX - $(".card").outerWidth(true) - 20;
						}
					}
					$(".card").css({ left: leftOffset, top: topOffset });
				}
			}
		},
		hideStadiumCard: function(e) {
			var id = $(e.currentTarget).data("id");
			if(id) {
				$("[data-id=" + id + "]").removeClass("active");
				$(".card").remove();
			}
		}
	});
	//-- END VIEWS --
	
	//-- CHECK FOR SAVED DATA --
	if(localStorageExists()) {
		if(localStorage.getItem("lightModeState") != null) {
			lightMode = localStorage.getItem("lightModeState") == "true";
		}
		if(localStorage.getItem("secretsState") !== null) {
			secretsVisible = localStorage.getItem("secretsState") == "true";
		}
		if(localStorage.getItem("evenSpacingState") !== null) {
			evenlySpaced = localStorage.getItem("evenSpacingState") == "true";
		}
	}
	//-- CHECKED FOR SAVED DATA --
	
	$("#root").toggleClass("dark", !lightMode);
	$("#root").toggleClass("secrets", secretsVisible);
	
	activeRouter = new App.Router;
	Backbone.history.start();
	
	if(window.location.search) {
		var team, player;
		_.each(window.location.search.substring(1).split("&"), function(searchParam) {
			var split = searchParam.split("=");
			switch(split[0]) {
				case "team":
					team = split[1];
					break;
				case "player":
					player = split[1];
			}
		});
		if(team) {
			if(player) {
				history.replaceState(null, "", window.location.pathname + "#" + team + "/" + player);
				activeRouter.navigate(team + "/" + player, { trigger: true, replace: true });
			} else {
				history.replaceState(null, "", window.location.pathname + "#" + team);
				activeRouter.navigate(team, { trigger: true, replace: true });
			}
		}
	}
	
	window.onresize = function() {
		if(updatesView) {
			updatesView.render();
		}
		if(advancedView) {
			advancedView.resize();
		}
		if(historyView) {
			historyView.render();
		}
		if(stadiumView) {
			stadiumView.render();
		}
	};
	
	function isMobile() {
		return /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent) || $(window).width() < 700;
	}

	function loadChart(team, player) {
		loadAssets(team, player, "chart");
	}
	
	function loadTable(team, player) {
		loadAssets(team, player, "table");
	}

	function loadAssets(team, player, style) {
		if(!globalTimes) {
			/*globalTimes = new App.Collections.TimeMap();
			var timeCount = 1000, timeSuccess = function(collection, response) {
				if(response.nextPage) {
					collection.fetchPage(timeCount, response.nextPage, timeSuccess);
				} else {
					globalLoaded.times = true;
					loadPage(team, player, style);
				}
			};
			globalTimes.fetchPage(timeCount, null, timeSuccess);*/
			globalTimes = new App.Collections.Times();
			globalTimes.fetch({
				success: function() {
					globalLoaded.times = true;
					loadPage(team, player, style);
				},
				error: console.log
			});
		}
		if(!globalTeams) {
			globalTeams = new App.Collections.Teams();
			globalTeams.fetch({
				success: function() {
					var groups = globalTeams.groupBy(function(model) { return model.type(); });
					_.each(groups, function(group, key) {
						groups[key] = _.sortBy(group, function(model) { return model.get("shorthand"); });
					});
					globalTeams.reset(_.union(groups.gamma9, groups.beta, groups.historical, groups.coffee, groups.coffee2, groups.gamma8, groups.gamma4, groups.gamma2, groups.gamma3, groups.gamma4, groups.gamma5, groups.gamma6, groups.gamma7, groups.unknown));
					globalTeams.add(new App.Models.Team({
						emoji: 0x1F3DB,
						fullName: "Hall of Flame",
						id: "tributes",
						mainColor: "#5988ff",
						permAttr: [],
						seasAttr: [],
						secondaryColor: "#5988ff",
						shorthand: "HoF",
						slogan: "Pay tribute.",
						type: "special"
					}));
					/*globalTeams.add(new App.Models.Team({
						emoji: 0x1F31F,
						fullName: "ILB Rising Stars",
						id: "stars",
						mainColor: "#6097b7",
						permAttr: [],
						seasAttr: [],
						secondaryColor: "#6097b7",
						shorthand: "Stars",
						slogan: "The League's Rising Star Players.",
						type: "special"
					}));
					globalTeams.add(new App.Models.Team({
						emoji: 0x1F3C6,
						fullName: "The Vault",
						id: "vault",
						mainColor: "#c5ac00",
						permAttr: [],
						seasAttr: [],
						secondaryColor: "#c5ac00",
						shorthand: "Vault",
						slogan: "Preserved.",
						type: "special"
					}));*/
					globalTeams.add(new App.Models.Team({
						emoji: 0x26BE,
						fullName: "All Players",
						id: "all",
						mainColor: "#424242",
						permAttr: [],
						seasAttr: [],
						secondaryColor: "#aaaaaa",
						shorthand: "All Players",
						slogan: "We are all love Blaseball.",
						type: "special"
					}), { at: 0 });
					if(!navView) {
						navView = new App.Views.Nav({
							collection: globalTeams.clone()
						});
					}
					globalLoaded.teams = true;
					loadPage(team, player, style);
				},
				error: console.log
			});
		}
		if(globalPlayers) {
			loadPage(team, player, style);
		} else {
			globalPlayers = new App.Collections.Players();
			var playerCount = 2000, playerSuccess = function(collection, response) {
				if(response.nextPage) {
					collection.fetchPage(playerCount, response.nextPage, playerSuccess);
				} else {
					globalLoaded.players = true;
					loadPage(team, player, style);
				}
			};
			globalPlayers.fetchPage(playerCount, null, playerSuccess);
		}
	}

	function loadPage(team, player, style) {
		if(_.all(globalLoaded)) {
			if(!player) {
				activePage.player = null;
				activePlayer = null;
			}
			if(team) {
				if(team != activePage.team) {
					loadTeam(team);
				}
				if(player && (player != activePage.player || style != activePage.style)) {
					if(style != activePage.style) {
						activePage.style = style;
					}
					loadPlayer(player);
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
	}
	
	function loadTeam(id) {
		activePage.team = id;
		if(globalTeams) {
			activeTeam = globalTeams.find(function(model) {
				return model.id == id || removeDiacritics(model.slug()) == removeDiacritics(id);
			});
			if(teamView) {
				teamView.undelegateEvents();
			}
			teamView = new App.Views.Team({
				model: activeTeam,
				collection: globalPlayers
			});
			loadPageView();
		}
	}
	
	function loadPlayer(id) {
		activePage.player = id;
		if(activeTeam) {
			if(stadiumView) {
				stadiumView.undelegateEvents();
			}
			if(historyView) {
				historyView.undelegateEvents();
			}
			if(advancedView) {
				advancedView.undelegateEvents();
			}
			if(updatesView) {
				updatesView.undelegateEvents();
			}
			if(id == "history") {
				historyView = new App.Views.TeamHistory({
					id: activeTeam.id,
					collection: new App.Collections.TeamUpdates
				});
				updatesView = null;
				advancedView = null;
				stadiumView = null;
				loadPageView();
			} else if(id == "stadium") {
				stadiumView = new App.Views.Stadiums({
					id: activeTeam.get("stadium"),
					collection: new App.Collections.StadiumUpdates
				});
				updatesView = null;
				advancedView = null;
				historyView = null;
				loadPageView();
			} else if(activeTeam.get("players") && activeTeam.get("players").length) {
				activePlayer = activeTeam.get("players").find(function(model) {
					return model.id == id || removeDiacritics(model.slug()) == activeTeam.slug() + "/" + removeDiacritics(id);
				});
				if(activePage.style == "table") {
					advancedView = new App.Views.AdvancedUpdates({
						id: activePlayer.id,
						collection: new App.Collections.Updates
					});
					updatesView = null;
				} else {
					updatesView = new App.Views.Updates({
						id: activePlayer.id,
						collection: new App.Collections.Updates
					});
					advancedView = null;
				}
				historyView = null;
				stadiumView = null;
				loadPageView();
			}
		}
	}
	
	function loadPageView() {
		var title = "Hloroscopes", path = "/";
		if(activePlayer) {
			title += " - " + activePlayer.canonicalName();
			path += activePlayer.slug();
		} else if(activeTeam) {
			title += " - " + activeTeam.canonicalName();
			path += activeTeam.slug();
		} 
		document.title = title;
		gtag('event', 'page_view', { page_title: title, page_location: window.location.href, page_path: path, send_to: GA_TRACKING_ID });
	}
	
	function parseEmoji(emoji, options) {
		return twemoji.parse(isNaN(Number(emoji)) ? emoji : twemoji.convert.fromCodePoint(emoji), options);
	}
	
	function getModifier(id) {
		var mod = _.findWhere(modifiers, { id: id });
		if(!mod) {
			mod = {
				id: id,
				emoji: "0x2753",
				title: id
			};
		}
		return mod;
	}
	
	function getLegendaryItem(id) {
		if(id) {
			var item = _.findWhere(oldItems, { id: id });
			if(!item) {
				item = {
					"id": id,
					"name": id,
					"attr": null
				}
			}
			item.health = 0;
			item.durability = -2; // unbreakable items are -1, hacked older legendary items to be -2
			return item;
		} else {
			return null;
		}
	}
	
	function formatDateLabel(date) {
		return date.toLocaleDateString(undefined, { "dateStyle": "short" });
	}

	function getPath(x1, y1, x2, y2, width) {
		var path = ["M", x2 + width, y2 + width];
		if(y1 > y2) {
			path.push(
				"L", x1 + width, y2 + width,
				"L", x1 + width, y1 - width,
				"L", x1 - width, y1 - width,
				"L", x1 - width, y2 - width
			);
		} else if(y1 < y2) {
			path.push(
				"L", x1 - width, y2 + width,
				"L", x1 - width, y1 + width,
				"L", x1 + width, y1 + width,
				"L", x1 + width, y2 - width
			);
		} else {
			path.push(
				"L", x1 - width, y1 + width,
				"L", x1 - width, y1 - width
			);
		}
		path.push("L", x2 + width, y2 - width, "Z");
		return path;
	}
	
	function convertRelativeToAbsoluteX(x, svg) {
		return (svg.innerWidth - svg.margin) * x + svg.padding + svg.margin;
	}
	
	function convertRelativeToAbsoluteY(y, svg) {
		return (svg.innerHeight - svg.padding - svg.margin) * (1 - y) + svg.padding + svg.titleOffset;
	}

	function calculateSvgTextWidth(text, textClass) {
		var textWidth = -1;
		$("body").append("<svg id='cstw' class='chart'><text" + (textClass ? (" class='" + textClass + "'") : "")+ ">" + text + "</text></svg>");
		textWidth = $("#cstw text")[0].getComputedTextLength();
		$("#cstw").remove();
		return textWidth;
	}
	
	function convertRomanNumerals(number) {
		var val = 0;
		while(number.indexOf("M") > -1) {
			var index = number.indexOf("M");
			if(index > 0 && number[index - 1] == "C") {
				val += 900;
				number = number.slice(0, index - 1) + number.slice(index + 1);
			} else {
				val += 1000;
				number = number.slice(0, index) + number.slice(index + 1);
			}
		}
		while(number.indexOf("D") > -1) {
			var index = number.indexOf("D");
			if(index > 0 && number[index - 1] == "C") {
				val += 400;
				number = number.slice(0, index - 1) + number.slice(index + 1);
			} else {
				val += 500;
				number = number.slice(0, index) + number.slice(index + 1);
			}
		}
		while(number.indexOf("C") > -1) {
			var index = number.indexOf("C");
			if(index > 0 && number[index - 1] == "X") {
				val += 90;
				number = number.slice(0, index - 1) + number.slice(index + 1);
			} else {
				val += 100;
				number = number.slice(0, index) + number.slice(index + 1);
			}
		}
		while(number.indexOf("L") > -1) {
			var index = number.indexOf("L");
			if(index > 0 && number[index - 1] == "X") {
				val += 40;
				number = number.slice(0, index - 1) + number.slice(index + 1);
			} else {
				val += 50;
				number = number.slice(0, index) + number.slice(index + 1);
			}
		}
		while(number.indexOf("X") > -1) {
			var index = number.indexOf("X");
			if(index > 0 && number[index - 1] == "I") {
				val += 9;
				number = number.slice(0, index - 1) + number.slice(index + 1);
			} else {
				val += 10;
				number = number.slice(0, index) + number.slice(index + 1);
			}
		}
		while(number.indexOf("V") > -1) {
			var index = number.indexOf("V");
			if(index > 0 && number[index - 1] == "I") {
				val += 4;
				number = number.slice(0, index - 1) + number.slice(index + 1);
			} else {
				val += 5;
				number = number.slice(0, index) + number.slice(index + 1);
			}
		}
		while(number.indexOf("I") > -1) {
			var index = number.indexOf("I");
			val += 1;
			number = number.slice(0, index) + number.slice(index + 1);
		}
		val += "";
		while(val.length < 4) {
			val = "0" + val;
		}
		return val;
	}
	
	function formatPlayerData(data) {
		var model = new App.Models.Player(data);
		return {
			allergy: model.get("peanutAllergy"),
			baserunning: model.calculateBaserunning(),
			batting: model.calculateBatting(),
			blood: model.blood(),
			canonical: model.canonicalName(),
			coffee: model.coffee(),
			deceased: model.get("deceased"),
			defense: model.calculateDefense(),
			edensity: model.get("eDensity") || null,
			evolution: model.get("evolution") || 0,
			fate: model.get("fate") || 0,
			fingers: model.get("totalFingers"),
			id: model.id || model.get("_id"),
			items: model.items(),
			modifiers: model.modifiers(),
			name: model.get("name"),
			pitching: model.calculatePitching(),
			ritual: model.get("ritual") || null,
			soulscream: model.calculateSoulscream(),
			teams: model.teams(),
			vibes: model.vibes()
		};
	}
	
	function formatTeamData(data) {
		var model = new App.Models.Team(data);
		return {
			arcana: model.arcana(),
			canonical: model.canonicalName(),
			championships: model.get("championships"),
			deceased: model.get("deceased") || false,
			emoji: model.get("emoji"),
			id: model.get("id"),
			level: model.level(),
			lineup: model.get("lineup"),
			modifiers: model.modifiers(),
			name: model.get("fullName"),
			rotation: model.get("rotation"),
			shadows: _.union(model.get("shadows"), model.get("bench"), model.get("bullpen")),
			slogan: model.get("slogan"),
			stadium: model.get("stadium"),
			underchampionships: model.get("underchampionships") || 0
		}
	}

	function formatStadiumData(data) {
		var model = new App.Models.Stadium(data);
		return {
			elongation: model.get("elongation"),
			filthiness: model.filthiness(),
			fortification: model.get("fortification"),
			forwardness: model.get("forwardness"),
			grandiosity: model.get("grandiosity"),
			hype: model.hype(),
			id: model.get("id"),
			improvements: model.improvements(),
			inconvenience: model.get("inconvenience"),
			luxuriousness: model.luxuriousness(),
			modifiers: model.get("mods"),
			mysticism: model.get("mysticism"),
			name: model.get("name"),
			nickname: model.get("nickname"),
			obtuseness: model.get("obtuseness"),
			ominousness: model.get("ominousness"),
			prefab: model.prefab(),
			viscosity: model.get("viscosity"),
			weather: model.weather()
		};
	}

	function removeDiacritics(str) {
		return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
