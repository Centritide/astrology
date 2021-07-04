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
requirejs(["jquery", "underscore", "backbone", "twemoji", "json!../blaseball/teams.json", "json!../blaseball/astrology.json", "json!../blaseball/modifiers.json"], function($, _, Backbone, twemoji, teamTypes, attributes, modifiers) {
	var App = {Models: {}, Collections: {}, Views: {}, Router: {}}, activeRouter, activePage, activeTeam, navView, globalTeams, globalPlayers, 
	descAttributes = _.chain(attributes.categories).reduce(function(c, d) { return _.union(c, d.attributes); }, []).where({ "direction": "desc" }).pluck("id").union(["name", "team", "position", "peanutAllergy", "rank"]).value(), summaryAttributes = _.chain(attributes.categories).union(attributes.sibrmetrics).pluck("id").union(["name", "team", "position", "modifications", "items", "combined", "rank"]).value(), columnGroups = _.chain(attributes.categories).union(attributes.sibrmetrics).reduce(function(c, d) { return c.concat(_.reduce(d.attributes, function(a, b) { return a.concat(b.id, d.group); }, [d.id, d.group])); }, []).chunk(2).object().value(), teamView, footerView, sortColumn = null, sortDirection = null, lightMode = false;
	
	//-- BEGIN ROUTER --
	App.Router = Backbone.Router.extend({
		routes: {
			"": "index",
			":team": "team"
		},
		index: function() {
			loadAssets();
		},
		team: function(team) {
			loadAssets(team);
		}
	});
	//-- END ROUTER --
	
	//-- BEGIN MODELS --
	App.Models.Nav = Backbone.Model.extend({});
	App.Models.Footer = Backbone.Model.extend({});
	App.Models.Team = Backbone.Model.extend({
		parse: function(data) {
			data.roster = _.union(data.lineup, data.rotation);
			return data;
		},
		emoji: function() {
			return parseEmoji(this.get("emoji"));
		},
		modifications: function() {
			return _.union(this.get("permAttr"),this.get("seasAttr"), this.get("weekAttr"), this.get("gameAttr"));
		},
		stadium: function() {
			return this.get("stadiumAttr") || [];
		},
		slug: function() {
			if(this.id == "9494152b-99f6-4adb-9573-f9e084bc813f") {
				return "baltimore-clabs";
			}
			return this.get("fullName").toLowerCase().replace(/\&/g, "-and-").replace(/[\,\.\']+/g, "").replace(/[\-\s]+/g, "-");
		},
		type: function() {
			var thisId = this.id;
			return _.findKey(teamTypes, function(ids) { return _.contains(ids, thisId); }) || "unknown";
		},
		getAverage: function(group, attribute) {
			var reduceFn;
			if(attribute == "peanutAllergy") {
				reduceFn = function(p, q) {
					return p + !!q;
				};
			}
			if(_.contains(summaryAttributes, attribute)) {
				reduceFn = function(p, q) {
					return p + q.getSummary(attribute);
				};
			} else {
				reduceFn = function(p, q) {
					return p + q.getAdjusted(attribute);
				};
			}
			return _.chain(this.get(group))
					.map(function(id) { 
						return globalPlayers.get(id); 
					})
					.reduce(reduceFn, 0)
					.value() / this.get(group).length;
		},
		getScaleClass: function(group, attribute) {
			var rating = this.getAverage(group, attribute);
			if(attribute == "combined") {
				rating /= 4;
			}
			if(_.contains(descAttributes, attribute)) {
				rating = 1 - rating;
			}
			return getScaleClassForRating(rating);
		}
	});
	App.Models.Stadium = Backbone.Model.extend({
		parse: function(data) {
			return data.data;
		}
	});
	App.Models.Player = Backbone.Model.extend({
		parse: function(data) {
			return data.data;
		},
		allergy: function() {
			return parseEmoji(this.get("peanutAllergy") ? 0x1F922 : 0x1F60B);
		},
		canonicalName: function() {
			if(!_.isEmpty(this.get("state")) && _.has(this.get("state"), "unscatteredName")) {
				return this.get("state").unscatteredName;
			}
			return this.get("name");
		},
		team: function() {
			if(this.get("deceased")) {
				return parseEmoji(0x1F3DB) + " The Hall";
			}
			if(_.contains(this.modifications(), "LEGENDARY") && !_.contains(this.modifications(), "REPLICA") || _.contains(this.modifications(), "DUST")) {
				return parseEmoji(0x1F3C6) + " The Vault";
			}
			var team = globalTeams.get(this.get("leagueTeamId"));
			if(!team) {
				team = globalTeams.get(this.get("tournamentTeamId"));
			}
			if(team) {
				return team.emoji() + " " + team.get("nickname");
			}
			return "-";
		},
		position: function() {
			var team = globalTeams.get(this.get("leagueTeamId"));
			if(!team) {
				team = globalTeams.get(this.get("tournamentTeamId"));
			}
			if(team) {
				if(_.contains(team.get("lineup"), this.id)) {
					return "Lineup";
				}
				if(_.contains(team.get("rotation"), this.id)) {
					return "Rotation";
				}
				if(_.contains(team.get("shadows"), this.id)) {
					return "Shadows";
				}
			}
			return "-";
		},
		modifications: function() {
			return _.union(this.get("permAttr"), this.get("itemAttr"), this.get("seasAttr"), this.get("weekAttr"), this.get("gameAttr"));
		},
		items: function() {
			return _.map(this.get("items"), function(item) {
				return "<span title=\"" + item.name + " (" + (item.durability > 0 ? (item.health > 0 ? (item.health + "/" + item.durability) : "broken") : "unbreakable") + ")\">" + parseEmoji(item.health > 0 ? getEmojiForItemRoot(item.root.name) : "0x274C") + "</span>";
			});
		},
		getSummary: function(id) {
			switch(id) {
				case "combined":
					return this.getSummary("batting") + this.getSummary("pitching") + this.getSummary("baserunning") + this.getSummary("defense");
				case "name":
					return this.canonicalName();
				case "team":
					return this.team();
				case "position":
					return this.position();
				case "modifications":
					return this.modifications().length;
				case "items":
					return _.reduce(this.get("items"), function(i, j) {
						return i + (j.health > 0 ? 1 : 0.4);
					}, 0);
			}
			var thisModel = this, category = _.findWhere(attributes.sibrmetrics, { id: id });
			if(category) {
				return _.chain(category.weights).map(function(weight, attribute) {
					return (_.contains(descAttributes, attribute) ? (1 - thisModel.getAdjusted(attribute)) : thisModel.getAdjusted(attribute)) * weight;
				}).reduce(function(m, n) {
					return m + n;
				}, 0).value();
			}
			category = _.findWhere(attributes.categories, { id: id });
			if(category) {
				return _.chain(category.attributes).map(function(attribute) {
					return Math.pow(_.contains(descAttributes, attribute.id) ? (1 - thisModel.getAdjusted(attribute.id)) : thisModel.getAdjusted(attribute.id), attribute.weight);
				}).reduce(function(m, n) {
					return m * n;
				}, 1).value();
			}
			return "N/A";
		},
		getAdjusted: function(attribute) {
			var attrVal = this.get(attribute);
			if(isItemsApplied()) {
				attrVal += this.getAdjustment(attribute);
				if(_.contains(descAttributes, attribute)) {
					attrVal = Math.min(attrVal, 0.999);
				}
				attrVal = Math.max(attrVal, 0.001);
			}
			return attrVal;
		},
		getAdjustment: function(attribute) {
			return _.get(this.getItemAdjustments(), attribute, 0);
		},
		getItemAdjustments: function() {
			var stats = ["tragicness", "buoyancy", "thwackability", "moxie", "divinity", "musclitude", "patheticism", "martyrdom", "cinnamon", "baseThirst", "laserlikeness", "continuation", "indulgence", "groundFriction", "shakespearianism", "suppression", "unthwackability", "coldness", "overpowerment", "ruthlessness", "pressurization", "omniscience", "tenaciousness", "watchfulness", "anticapitalism", "chasiness"], adjustments = {};
			_.each(this.get("items"), function(item) {
				if(item.health > 0) {
					_.chain([item.prePrefix, item.postPrefix, item.root, item.suffix])
						.union(item.prefixes)
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
				}
			});
			return adjustments;
		},
		getTooltip: function(attribute) {
			var adjustment = this.getAdjustment(attribute);
			return (Math.round(this.get(attribute) * 1000) / 1000) + (adjustment ? ((adjustment < 0 ? " - " : " + ") + Math.abs(Math.round(adjustment * 1000) / 1000)) : "");
		},
		getScaleClass: function(attribute) {
			var rating = _.contains(summaryAttributes, attribute) ? this.getSummary(attribute) : this.getAdjusted(attribute);
			if(attribute == "combined") {
				rating /= 4;
			}
			if(_.contains(descAttributes, attribute)) {
				rating = 1 - rating;
			}
			return getScaleClassForRating(rating);
		}
	});
	App.Models.PlayerId = Backbone.Model.extend({
		idAttribute: "playerId"
	});
	//-- END MODELS --
	
	//-- BEGIN COLLECTIONS --
	App.Collections.Teams = Backbone.Collection.extend({
		url: "https://api.sibr.dev/corsmechanics/www.blaseball.com/database/allTeams",
		model: App.Models.Team,
		isLightMode: function() {
			return lightMode;
		}
	});
	App.Collections.Stadiums = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v2/entities?type=stadium",
		model: App.Models.Stadium,
		parse: function(data) {
			return data.items;
		}
	});
	App.Collections.Players = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v2/entities?type=player",
		model: App.Models.Player,
		parse: function(data) {
			return data.items
		}
	});
	App.Collections.Tributes = Backbone.Collection.extend({
		url: "https://api.sibr.dev/corsmechanics/www.blaseball.com/api/getTribute",
		model: App.Models.PlayerId,
		parse: function(data) {
			return data.players;
		}
	});
	App.Collections.Stars = Backbone.Collection.extend({
		url: "https://api.sibr.dev/corsmechanics/www.blaseball.com/api/getRisingStars",
		model: App.Models.PlayerId,
		parse: function(data) {
			return _.map(data.stars, function(id) { return { playerId: id } });
		}
	});
	App.Collections.Vault = Backbone.Collection.extend({
		url: "https://api.sibr.dev/corsmechanics/www.blaseball.com/database/vault",
		model: App.Models.PlayerId,
		parse: function(data) {
			return _.map(data.legendaryPlayers, function(id) { return { playerId: id } });
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
			this.$el.html(this.template(globalTeams));
		}
	});
	App.Views.Footer = Backbone.View.extend({
		template: _.template($("#template-footer").html()),
		el: "footer",
		initialize: function() {
			if(localStorageExists()) {
				if(localStorage.getItem("items_state") !== null) {
					this.model.set("items", localStorage.getItem("items_state") == "true");
				}
				if(localStorage.getItem("group_active_state") !== null) {
					this.model.set("group_active", localStorage.getItem("group_active_state") == "true");
				}
				if(localStorage.getItem("shadows_state") !== null) {
					this.model.set("shadows", localStorage.getItem("shadows_state") == "true");
				}
				if(localStorage.getItem("forbidden_knowledge_state") !== null) {
					this.model.set("forbidden_knowledge", localStorage.getItem("forbidden_knowledge_state") == "true");
				}
			}
			this.render();
		},
		render: function() {
			this.$el.html(this.template({
				model: this.model,
				emoji: parseEmoji,
				isLightMode: function() {
					return lightMode;
				}
			}));
		},
		events: {
			"change input[data-toggle]": "toggleCheckbox",
			"click a[data-toggle-faq]": "toggleFaq",
			"click a[data-toggle-lights]": "toggleLights"
		},
		toggleCheckbox: function(e) {
			var type = $(e.currentTarget).data("toggle"), isChecked = $(e.currentTarget).prop("checked");
			this.model.set(type, isChecked);
			if(localStorageExists()) {
				localStorage.setItem(type + "_state", isChecked);
			}
			switch(type) {
				case "forbidden_knowledge":
				case "shadows":
					this.render();
					// falls through
				case "group_active":
				case "items":
					if(teamView) {
						teamView.render();
					}
					break;
			}
			gtag('event', 'toggle_' + type);
		},
		toggleFaq: function(e) {
			e.preventDefault();
			var faqActive = !$(e.currentTarget).data("toggle-faq");
			$(e.currentTarget).data("toggle-faq", faqActive);
			if(faqActive) {
				$("main").append(_.template($("#template-faq").html())({ 
					columns: attributes, 
					ucFirst: function(str) {
						return str[0].toUpperCase() + str.substring(1);
					}
				}));
			} else {
				$("section.faq").remove();
			}
			gtag('event', 'toggle_faq');
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
			if(localStorageExists()) {
				localStorage.setItem("lightModeState", lightMode);
			}
			gtag('event', 'toggle_lights');
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
						thisView.model.set(thisView.model.id, _.map(thisCollection.pluck("playerId")));
						thisView.render();
					},
					error: console.log
				});
			} else {
				this.render();
			}
		},
		render: function() {
			var thisView = this, groups = [], scrollPos;
			if($("section.team").length) {
				scrollPos = { x: $("section.team").scrollLeft(), y: $("section.team").scrollTop() };
			}
			switch(this.model.id) {
				case "all":
				case "stars":
				case "tributes":
				case "vault":
					groups = [this.model.id];
					break;
				default:
					groups = _.union(groups, isRosterCombined() ? ["roster"] : ["lineup", "rotation"]);
					if(isShadowsVisible()) {
						groups = _.union(groups, ["shadows"]);
					}
			}
			if(sortColumn) {
				var sortGroups = {}, chain;
				_.each(groups, function(group) {
					chain = group == "all" ? globalPlayers.chain() : _.chain(thisView.model.get(group)).map(function(id) {
						 return globalPlayers.get(id);
					});
					chain = chain.sortBy(function(player) {
						return _.contains(summaryAttributes, sortColumn) ? player.getSummary(sortColumn) : player.getAdjusted(sortColumn);
					}).pluck("id");
					if(sortDirection == "desc") {
						chain = chain.reverse();
					}
					sortGroups[group] =	chain.value();
				});
				this.model.set("sorted", sortGroups);
			} else {
				this.model.unset("sorted");
			}
			this.$el.html(this.template({
				groups: groups,
				columns: attributes, 
				team: this.model, 
				players: this.collection,
				emoji: parseEmoji,
				isKnowledgeVisible: isKnowledgeVisible,
				getModifier: function(modifier) {
					var modifier = getModifier(modifier), description = "";
					if(modifier.description) {
						description = " - " + ((modifier.descriptions && modifier.descriptions.player) ? modifier.descriptions.player : modifier.description);
					}
					return "<span title=\"" + modifier.title + description + "\">" + parseEmoji(modifier.emoji) + "</span>"
				},
				ucFirst: function(str) {
					return str[0].toUpperCase() + str.substring(1);
				}
			}));
			if(sortColumn) {
				$("[data-sort=" + sortColumn + "]").attr("data-direction", sortDirection);
			}
			if(scrollPos) {
				$("section.team").scrollLeft(scrollPos.x);
				$("section.team").scrollTop(scrollPos.y);
			}
		},
		events: {
			"click th": "sortPlayers"
		},
		sortPlayers: function(e) {
			var sort = $(e.currentTarget).data("sort"), isReversed = _.contains(descAttributes, sort);
			e.preventDefault();
			if(sort) {
				switch($(e.currentTarget).data("direction")) {
					case "asc":
						sortDirection = isReversed ? "desc" : null;
						break;
					case "desc":
						sortDirection = isReversed ? null : "asc";
						break;
					default:
						sortDirection = isReversed ? "asc" : "desc";
						break;
				}
				sortColumn = sortDirection ? sort : null;
				this.render();
			}
		}
	});
	App.Views.Squeezer = Backbone.View.extend({
		template: _.template($("#template-squeezer").html()),
		el: "main",
		initialize: function() {
			var thisView = this, 
				stadiums = new App.Collections.Stadiums(), 
				league = _.chain(this.collection).reduce(function(t, u) {
					return {
						lineup: _.union(t.lineup, u.get("lineup")),
						rotation: _.union(t.rotation, u.get("rotation"))
					}
				}, { "lineup": [], "rotation": [] }).value();
			this.collection.push(new App.Models.Team({
				emoji: 0x26BE,
				id: "all",
				lineup: league.lineup,
				mainColor: "#424242",
				rotation: league.rotation,
				roster: _.union(league.lineup, league.rotation),
				nickname: "League Average",
			}));
			stadiums.fetch({
				success: function(collection) {
					collection.each(function(model) {
						_.find(thisView.collection, function(team) {
							return team.id == model.get("teamId");
						}).set("stadiumAttr", model.get("mods"));
					});
					thisView.render();
				},
				error: console.log
			});
		},
		render: function() {
			var scrollPos;
			if($("section.team").length) {
				scrollPos = { x: $("section.team").scrollLeft(), y: $("section.team").scrollTop() };
			}
			this.calculateRanks();
			if(sortColumn) {
				var chain = _.chain(this.collection);
				chain = chain.sortBy(function(team) {
					switch(sortColumn) {
						case "combined":
							return team.getAverage("roster", sortColumn);
						case "name":
							return team.get("nickname");
						case "modifications":
							return team.modifications().length;
						case "stadium":
							return team.stadium().length;
						case "rank":
							return team.get("rank");
					}
					return team.getAverage(columnGroups[sortColumn], sortColumn);
				});
				if(sortDirection == "desc") {
					chain = chain.reverse();
				}
				this.model.set("sorted", chain.value());
			} else {
				this.model.unset("sorted");
			}
			this.$el.html(this.template({
				svg: {
					radius: 15,
					padding: 40,
					size: $("main").innerHeight() > $("main").innerWidth() ? $("main").innerWidth() : Math.min($("main").innerHeight(), $("main").innerWidth() / 2),
					data: this.generateSvgData()
				},
				columns: attributes,
				model: this.model,
				collection: this.collection,
				isKnowledgeVisible: isKnowledgeVisible,
				emoji: parseEmoji,
				getModifier: function(modifier) {
					var modifier = getModifier(modifier), description = "";
					if(modifier.description) {
						description = " - " + ((modifier.descriptions && modifier.descriptions.team) ? modifier.descriptions.team : modifier.description);
					}
					return "<span title=\"" + modifier.title + description + "\">" + parseEmoji(modifier.emoji) + "</span>"
				},
				ucFirst: function(str) {
					return str[0].toUpperCase() + str.substring(1);
				}
			}));
			if(sortColumn) {
				$("[data-sort=" + sortColumn + "]").attr("data-direction", sortDirection);
			}
			if(scrollPos) {
				$("section.team").scrollLeft(scrollPos.x);
				$("section.team").scrollTop(scrollPos.y);
			}
		},
		calculateRanks: function() {
			_.chain(this.collection)
				.filter(function(team) {
					return team.type() == "ilb";
				})
				.each(function(team) { team.set("rank", team.getAverage("lineup", "wobabr") + team.getAverage("rotation", "erpr")); })
				.sortBy(function(team) { return team.get("rank"); })
				.reverse()
				.each(function(team, index) { return team.set("rank", index + 1); });
		},
		generateSvgData: function() {
			var data = {
				maxes: {},
				mins: {},
				ranges: {},
				points: _.map(this.collection, function(team) {
					return {
						id: team.id,
						color: team.get("mainColor"),
						name: team.get("nickname"),
						src: $(parseEmoji(team.get("emoji"), { "folder": "svg", "ext": ".svg" })).attr("src"),
						wobabr: team.getAverage("lineup", "wobabr"),
						bsrr: team.getAverage("lineup", "bsrr"),
						erpr: team.getAverage("rotation", "erpr"),
						defense: team.getAverage("roster", "defense")
					};
				})
			};
			_.each(["wobabr", "bsrr", "erpr", "defense"], function(attribute) {
				var chain = _.chain(data.points).pluck(attribute);
				data.maxes[attribute] = Math.ceil(chain.max().value() * 10);
				data.mins[attribute] = Math.floor(chain.min().value() * 10);
				data.ranges[attribute] = data.maxes[attribute] - data.mins[attribute];
			});
			_.each(data.points, function(point) {
				point.x1 = (point.wobabr * 10 - data.mins.wobabr) / data.ranges.wobabr;
				point.y1 = (data.maxes.bsrr - point.bsrr * 10) / data.ranges.bsrr;
				point.x2 = (point.erpr * 10 - data.mins.erpr) / data.ranges.erpr;
				point.y2 = (data.maxes.defense - point.defense * 10) / data.ranges.defense;
			});
			return data;
		},
		events: {
			"click th": "sortTeams",
			"mouseenter .charts circle[data-id], .charts image[data-id]": "showChartHover",
			"mouseleave .charts circle[data-id], .charts image[data-id]": "hideChartHover"
		},
		sortTeams: function(e) {
			var sort = $(e.currentTarget).data("sort"), isReversed = _.contains(descAttributes, sort);
			e.preventDefault();
			if(sort) {
				switch($(e.currentTarget).data("direction")) {
					case "asc":
						sortDirection = isReversed ? "desc" : null;
						break;
					case "desc":
						sortDirection = isReversed ? null : "asc";
						break;
					default:
						sortDirection = isReversed ? "asc" : "desc";
						break;
				}
				sortColumn = sortDirection ? sort : null;
				this.render();
			}
		},
		showChartHover: function(e) {
			var id = $(e.currentTarget).data("id");
			if(id) {
				var team = _.findWhere(this.collection, { id : id }),
					wobabrBsrrEl = $("<div class='chart-hover'><p><strong>" + team.get("nickname") + "</strong></p><p>" + (Math.round(team.getAverage("lineup", "wobabr") * 5000) / 1000) + " wOBABR</p><p>" + (Math.round(team.getAverage("lineup", "bsrr") * 5000) / 1000) + " BsRR</p></div>"),
					wobabrBsrrCircEl = $("#chart-wobabr-bsrr circle[data-id=" + id + "]"),
					erprDefenseEl = $("<div class='chart-hover'><p><strong>" + team.get("nickname") + "</strong></p><p>" + (Math.round(team.getAverage("rotation", "erpr") * 5000) / 1000) + " ERPR</p><p>" + (Math.round(team.getAverage("roster", "defense") * 5000) / 1000) + " Defense Stars</p></div>"),
					erprDefenseCircEl = $("#chart-erpr-defense circle[data-id=" + id + "]");
				$("[data-id=" + id + "]").addClass("active");
				$(".chart-hover").remove();
				$("#chart-wobabr-bsrr").append($("#chart-wobabr-bsrr [data-id=" + id + "]").remove());
				wobabrBsrrEl.css({
					left: wobabrBsrrCircEl.position().left + 15,
					top: parseFloat(wobabrBsrrCircEl.attr("cy")) + 25
				});
				$(".charts").append(wobabrBsrrEl);
				$("#chart-erpr-defense").append($("#chart-erpr-defense [data-id=" + id + "]").remove());
				erprDefenseEl.css({
					left: erprDefenseCircEl.position().left + 15,
					top: parseFloat(erprDefenseCircEl.attr("cy")) + 25
				});
				$(".charts").append(erprDefenseEl);
			}
		},
		hideChartHover: function(e) {
			var id = $(e.currentTarget).data("id");
			if(id) {
				$("[data-id=" + id + "]").removeClass("active");
				$(".chart-hover").remove();
			}
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
	
	window.onresize = function() {
		if(teamView) {
			teamView.render();
		}
	};
	
	function loadAssets(id) {
		if(!globalTeams) {
			globalTeams = new App.Collections.Teams();
			globalTeams.fetch({
				success: function() {
					var groups = globalTeams.groupBy(function(model) { return model.type(); });
					_.each(groups, function(group, key) {
						groups[key] = _.sortBy(group, function(model) { return model.get("shorthand"); });
					});
					globalTeams.reset(_.union(groups.ilb, groups.ulb, groups.coffee, groups.coffee2, groups.unknown));
					globalTeams.add(new App.Models.Team({
						emoji: 0x1F3DB,
						fullName: "Hall of Flame",
						id: "tributes",
						mainColor: "#5988ff",
						secondaryColor: "#5988ff",
						shorthand: "HoF",
						slogan: "Pay tribute."
					}));
					globalTeams.add(new App.Models.Team({
						emoji: 0x1F31F,
						fullName: "Rising Stars",
						id: "stars",
						mainColor: "#6097b7",
						secondaryColor: "#6097b7",
						shorthand: "Stars",
						slogan: "The League's Rising Star Players."
					}));
					globalTeams.add(new App.Models.Team({
						emoji: 0x1F3C6,
						fullName: "The Vault",
						id: "vault",
						mainColor: "#c5ac00",
						secondaryColor: "#c5ac00",
						shorthand: "Vault",
						slogan: "Preserved."
					}));
					globalTeams.add(new App.Models.Team({
						emoji: 0x1F9EE,
						fullName: "Stat Squeezer",
						id: "squeezer",
						mainColor: "#885a84",
						secondaryColor: "#da94d4",
						shorthand: "Squeezer",
						slogan: "The Stat Squeezer."
					}), { at: 0 });
					globalTeams.add(new App.Models.Team({
						emoji: 0x26BE,
						fullName: "All Players",
						id: "all",
						mainColor: "#424242",
						secondaryColor: "#aaaaaa",
						shorthand: "All Players",
						slogan: "We are all love Blaseball."
					}), { at: 0 });
					if(!navView) {
						navView = new App.Views.Nav();
					}
					loadPage(id);
				},
				error: console.log
			});
		}
		if(globalPlayers) {
			loadPage(id);
		} else {
			globalPlayers = new App.Collections.Players();
			globalPlayers.fetch({
				success: function() {
					loadPage(id);
				},
				error: console.log
			});
		}
	}

	function loadPage(id) {
		if(globalPlayers.length && globalTeams.length) {
			if(!id) {
				$("main").html(_.template($("#template-index").html())({ 
					isLightMode: function() { 
						return lightMode; 
					}, 
					emoji: parseEmoji 
				}));
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
			} else if(id != activePage) {
				activePage = id;
				activeTeam = globalTeams.find(function(model) {
					return model.id == id || model.slug() == id;
				});
				if(!footerView) {
					footerView = new App.Views.Footer({
						model: new App.Models.Footer({
							items: true,
							group_active: false,
							shadows: false,
							forbidden_knowledge: false
						})
					});
				}
				if(teamView) {
					teamView.undelegateEvents();
				}
				if(activeTeam.id == "squeezer") {
					teamView = new App.Views.Squeezer({
						model: activeTeam,
						collection: globalTeams.filter(function(team) {
							return team.type() == "ilb";
						})
					});
				} else {
					teamView = new App.Views.Team({
						model: activeTeam,
						collection: globalPlayers
					});
				}
				loadPageView();
			}
		}
	}
	
	function loadPageView() {
		var title = "Astrology", path = "/";
		if(activeTeam) {
			title += " - " + activeTeam.get("fullName");
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

	function getEmojiForItemRoot(root) {
		switch(root) {
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
			case "Field":
				return "0x1F535";
			case "Glove":
				return "0x1F9E4";
			case "Helmet":
				return "0x1FA96";
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
	
	function getScaleClassForRating(rating) {
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
	}
	
	function isItemsApplied() {
		return footerView ? footerView.model.get("items") : $("[data-toggle=items]").prop("checked");
	}
	
	function isRosterCombined() {
		return footerView ? footerView.model.get("group_active") : $("[data-toggle=group_active]").prop("checked");
	}
	
	function isShadowsVisible() {
		return footerView ? footerView.model.get("shadows") : $("[data-toggle=shadows]").prop("checked");
	}
	
	function isKnowledgeVisible() {
		return footerView ? footerView.model.get("forbidden_knowledge") : $("[data-toggle=forbidden_knowledge]").prop("checked");
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