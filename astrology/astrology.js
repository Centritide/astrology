/**
 * RequireJS configuration
 * 
 */
requirejs.config({
    waitSeconds : 0,
	paths : {
		jquery: "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.5.1/jquery.min",
		backbone: "https://cdnjs.cloudflare.com/ajax/libs/backbone.js/1.4.0/backbone-min",
		underscore: "https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.11.0/underscore-min",
		twemoji: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/12.0.4/2/twemoji.min"
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
requirejs(["jquery", "underscore", "backbone", "twemoji"], function($, _, Backbone, twemoji) {
	var App = {Models: {}, Collections: {}, Views: {}, Router: {}}, activeRouter, activePage, activeTeam, navView, teamView, footerView, sortColumn = null, sortDirection = null, lightMode = false, secretsVisible = false, shadowsActive = false, positionsCombined = false;
	
	//-- BEGIN ROUTER --
	App.Router = Backbone.Router.extend({
		routes: {
			"": "index",
			":team": "team",
			":team/forbidden-knowledge": "teamSecrets"
		},
		index: function() {
			loadPage();
		},
		team: function(team) {
			secretsVisible = false;
			loadPage(team);
		},
		teamSecrets: function(team) {
			secretsVisible = true;
			loadPage(team);
		}
	});
	//-- END ROUTER --
	
	//-- BEGIN MODELS --
	App.Models.Nav = Backbone.Model.extend({});
	App.Models.Team = Backbone.Model.extend({
		slug: function() {
			return this.get("fullName").toLowerCase().replace(/\&/g, "-and-").replace(/[\,\.\']+/g, "").replace(/[\-\s]+/g, "-");
		},
		type: function() {
			switch(this.id) {
				case "players":
				case "tributes":
				case "40b9ec2a-cb43-4dbb-b836-5accb62e7c20": // pods
				case "c6c01051-cdd4-47d6-8a98-bb5b754f937f": // hall stars
					return "special";
				case "70eab4ab-6cb1-41e7-ac8b-1050ee12eecc": // light and sweet
				case "9e42c12a-7561-42a2-b2d0-7cf81a817a5e": // macchiato
				case "b3b9636a-f88a-47dc-a91d-86ecc79f9934": // cream and sugar
				case "4d921519-410b-41e2-882e-9726a4e54a6a": // cold brew
				case "e3f90fa1-0bbe-40df-88ce-578d0723a23b": // flat white
				case "4e5d0063-73b4-440a-b2d1-214a7345cf16": // americano
				case "d8f82163-2e74-496b-8e4b-2ab35b2d3ff1": // espresso
				case "e8f7ffee-ec53-4fe0-8e87-ea8ff1d0b4a9": // heavy foam
				case "49181b72-7f1c-4f1c-929f-928d763ad7fb": // latte
				case "a3ea6358-ce03-4f23-85f9-deb38cb81b20": // decaf
				case "a7592bd7-1d3c-4ffb-8b3a-0b1e4bc321fd": // milk substitute
				case "9a5ab308-41f2-4889-a3c3-733b9aab806e": // plenty of sugar
					return "coffee";
				case "f29d6e60-8fce-4ac6-8bc2-b5e3cabc5696": // black
				case "3b0a289b-aebd-493c-bc11-96793e7216d5": // blasesonas
				case "d2634113-b650-47b9-ad95-673f8e28e687": // sibr
				case "7fcb63bc-11f2-40b9-b465-f1d458692a63": // real game band
					return "coffee2";
				default:
					return "ilb";
			}
						
		},
		players: function(position) {
			var teamPlayers = this.get("players"), positionIds;
			switch(position) {
				case "Team":
					positionIds = _.union(this.get("lineup"), this.get("rotation"), this.get("tributes"));
					break;
				case "Shadows":
					positionIds = _.union(this.get("bench"), this.get("bullpen"), this.get("percolated"));
					break;
				default:
					positionIds = this.get(position.toLowerCase());
			}
			return _.template($("#template-" + (secretsVisible ? "stlats" : "players")).html())({
				isCombined: function() {
					return positionsCombined;
				},
				emoji: parseEmoji,
				position: position,
				average: function(players, stlat) {
					return _.reduce(players, function(p, q) {
						switch(stlat) {
							case "overallRating":
								return p + q.calculateOverallRating();
							case "hittingRating":
								return p + q.calculateBatting();
							case "pitchingRating":
								return p + q.calculatePitching();
							case "baserunningRating":
								return p + q.calculateBaserunning();
							case "defenseRating":
								return p + q.calculateDefense();
							case "totalRating":
								return p + q.calculateTotalRating();
							case "wobaRating":
								return p + q.calculateWobaRating();
							case "sluggingRating":
								return p + q.calculateSluggingRating();
							case "earnedRunsRating":
								return p + q.calculateEarnedRunsRating();
							default:
								return p + q.get(stlat);
						}
					}, 0) / players.length;
				}, 
				round: function(value) {
					return Math.round(value * 10000) / 10000;
				},
				scale: scaleColorForRating,
				scaleInverse: function(rating) {
					return scaleColorForRating(1 - rating);
				},
				stars: function(rating) {
					var i, stars = "", rounded = Math.round(rating * 10);
					for(i = 0; i < Math.floor(rounded / 2); i++) {
						stars += "<i class='full-star'>" + parseEmoji(0x2B50) + "</i>";
					}
					if(rounded % 2) {
						stars += "<i class='half-star'>" + parseEmoji(0x2B50) + "</i>";
					}
					return stars;
				},
				players: (function() {
					var chain = _.chain(positionIds).map(function(id) {
						return teamPlayers.findWhere({ id: id });
					});
					if(sortColumn) {
						chain = chain.sortBy(function(player) {
							switch(sortColumn) {
								case "overallRating":
									return player.calculateOverallRating();
								case "hittingRating":
									return player.calculateBatting();
								case "pitchingRating":
									return player.calculatePitching();
								case "baserunningRating":
									return player.calculateBaserunning();
								case "defenseRating":
									return player.calculateDefense();
								case "totalRating":
									return player.calculateTotalRating();
								case "wobaRating":
									return player.calculateWobaRating();
								case "sluggingRating":
									return player.calculateSluggingRating();
								case "earnedRunsRating":
									return player.calculateEarnedRunsRating();
								default:
									return player.get(sortColumn);
							}
						});
					}
					if(sortDirection == "desc") {
						chain = chain.reverse();
					}
					return chain.value();
				})()
			});
		},
		emoji: parseEmoji,
		isCombined: function() {
			return positionsCombined;
		},
		isForbidden: function() {
			return secretsVisible;
		},
		isShadows: function() {
			return shadowsActive;
		},
		isLightMode: function() {
			return lightMode;
		}
	});
	App.Models.Tribute = Backbone.Model.extend({});
	App.Models.Player = Backbone.Model.extend({
		getPosition: function() {
			if(_.contains(_.union(activeTeam.get("lineup"), activeTeam.get("bench")), this.id)) {
				return "batter";
			} else if(_.contains(_.union(activeTeam.get("rotation"), activeTeam.get("bullpen")), this.id)) {
				return "pitcher";
			} else {
				return "unknown";
			}
		},
		calculateOverallRating: function(position) {
			switch(this.getPosition()) {
				case "batter":
					return this.calculateBatting();
				case "pitcher":
					return this.calculatePitching();
				default:
					return Math.max(this.calculateBatting(), this.calculatePitching());
			}
		},
		calculateBatting: function() {
			return (
				Math.pow(1 - this.get("tragicness"), 0.01) *
				Math.pow(this.get("buoyancy"), 0) *
				Math.pow(this.get("thwackability"), 0.35) *
				Math.pow(this.get("moxie"), 0.075) *
				Math.pow(this.get("divinity"), 0.35) *
				Math.pow(this.get("musclitude"), 0.075) *
				Math.pow(1 - this.get("patheticism"), 0.05) *
				Math.pow(this.get("martyrdom"), 0.02)
			);
		},
		calculatePitching: function() {
			return (
				Math.pow(this.get("shakespearianism"), 0.1) *
				Math.pow(this.get("suppression"), 0) *
				Math.pow(this.get("unthwackability"), 0.5) *
				Math.pow(this.get("coldness"), 0.025) *
				Math.pow(this.get("overpowerment"), 0.15) *
				Math.pow(this.get("ruthlessness"), 0.4)
			);
		},
		calculateBaserunning: function() {
			return (
				Math.pow(this.get("laserlikeness"), 0.5) *
				Math.pow(this.get("continuation"), 0.1) *
				Math.pow(this.get("baseThirst"), 0.1) *
				Math.pow(this.get("indulgence"), 0.1) *
				Math.pow(this.get("groundFriction"), 0.1)
			);
		},
		calculateDefense: function() {
			return (
				Math.pow(this.get("omniscience"), 0.2) *
				Math.pow(this.get("tenaciousness"), 0.2) *
				Math.pow(this.get("watchfulness"), 0.1) *
				Math.pow(this.get("anticapitalism"), 0.1) *
				Math.pow(this.get("chasiness"), 0.1)
			);
		},
		calculateTotalRating: function() {
			return this.calculateBatting() 
				+ this.calculatePitching() 
				+ this.calculateBaserunning() 
				+ this.calculateDefense();
		},
		calculateWobaRating: function() {
			return this.get("divinity") * 0.21 + this.get("martyrdom") * 0.07 + this.get("moxie") * 0.09 + this.get("musclitude") * 0.04 + (1 - this.get("patheticism")) * 0.17 + this.get("thwackability") * 0.35 + this.get("groundFriction") * 0.06;
		},
		calculateSluggingRating: function() {
			return this.get("divinity") * 0.25 + this.get("musclitude") * 0.13 + (1 - this.get("patheticism")) * 0.11 + this.get("thwackability") * 0.37 + this.get("groundFriction") * 0.14;
		},
		calculateEarnedRunsRating: function() {
			return this.get("overpowerment") * 0.13 + this.get("ruthlessness") * 0.47 + this.get("unthwackability") * 0.40;
		}
	});
	//-- END MODELS --
	
	//-- BEGIN COLLECTIONS --
	App.Collections.Teams = Backbone.Collection.extend({
		url: "https://cors-proxy.blaseball-reference.com/database/allTeams",
		model: App.Models.Team,
		emoji: parseEmoji,
		isForbidden: function() {
			return secretsVisible;
		},
		isLightMode: function() {
			return lightMode;
		}
	});
	App.Collections.Tributes = Backbone.Collection.extend({
		url: "https://cors-proxy.blaseball-reference.com/api/getTribute",
		model: App.Models.Tribute
	});
	App.Collections.Players = Backbone.Collection.extend({
		url: "https://cors-proxy.blaseball-reference.com/database/players",
		model: App.Models.Player
	});
	//-- END COLLECTIONS --
	
	//-- BEGIN VIEWS --
	App.Views.Nav = Backbone.View.extend({
		template: _.template($("#template-nav").html()),
		el: "nav",
		initialize: function() {
			thisView = this;
			this.collection.fetch({
				success: function() {
					var groups = thisView.collection.groupBy(function(model) { return model.type(); });
					_.each(groups, function(group, key) {
						groups[key] = _.sortBy(group, function(model) { return model.get("shorthand"); });
					});
					thisView.collection.reset(_.union(groups.ilb, groups.coffee, groups.coffee2, groups.special));
					thisView.collection.add(new App.Models.Team({
						emoji: 0x1F3DB,
						fullName: "Hall of Flame",
						id: "tributes",
						mainColor: "#5988ff",
						secondaryColor: "#5988ff",
						shorthand: "HoF",
						slogan: "Pay tribute."
					}));
					thisView.collection.add(new App.Models.Team({
						emoji: 0x26BE,
						fullName: "All Players",
						id: "players",
						mainColor: "#424242",
						secondaryColor: "#aaaaaa",
						shorthand: "All Players",
						slogan: "We are all love Blaseball."
					}), { at: 0 });
					thisView.render();
					if(activePage) {
						loadTeam(activePage);
					}
				},
				error: console.log
			});
		},
		render: function() {
			this.$el.html(this.template(this.collection));
			$("#root").toggleClass("dark", !lightMode);
		},
		events: {
			"click a": "selectTeam"
		},
		selectTeam: function(e) {
			e.preventDefault();
			activeRouter.navigate(e.currentTarget.href.split("#")[1], { trigger: true });
		}
	});
	App.Views.Footer = Backbone.View.extend({
		template: _.template($("#template-footer").html()),
		el: "footer",
		initialize: function() {
			this.render();
		},
		render: function() {
			this.$el.html(this.template({
				emoji: parseEmoji,
				isCombined: function() {
					return positionsCombined;
				},
				isForbidden: function() {
					return secretsVisible;
				},
				isShadows: function() {
					return shadowsActive;
				},
				isLightMode: function() {
					return lightMode;
				}
			}));
		},
		events: {
			"click a[data-toggle-knowledge]": "toggleKnowledge",
			"click a[data-toggle-shadows]": "toggleShadows",
			"click a[data-toggle-positions]": "togglePositions",
			"click a[data-toggle-faq]": "toggleFaq",
			"click a[data-toggle-lights]": "toggleLights"
		},
		toggleKnowledge: function(e) {
			e.preventDefault();
			activeRouter.navigate(activeTeam.slug() + (secretsVisible ? "" : "/forbidden-knowledge"), { trigger: true });
			if(navView) {
				navView.render();
			}
			if(footerView) {
				footerView.render();
			}
			gtag('event', 'toggle_forbidden_knowledge');
		},
		toggleShadows: function(e) {
			e.preventDefault();
			shadowsActive = !$(e.currentTarget).data("toggle-shadows");
			$(e.currentTarget).data("toggle-shadows", shadowsActive);
			$(e.currentTarget).html((shadowsActive ? "Hide" : "Peer into") + " the Shadows");
			if(teamView) {
				teamView.render();
			}
			if(localStorageExists()) {
				localStorage.setItem("shadowsState", shadowsActive);
			}
			gtag('event', 'toggle_shadows');
		},
		togglePositions: function(e) {
			e.preventDefault();
			positionsCombined = !$(e.currentTarget).data("toggle-positions");
			$(e.currentTarget).data("toggle-positions", positionsCombined);
			$(e.currentTarget).html((positionsCombined ? "Separate" : "Combine") + " Positions");
			if(teamView) {
				teamView.render();
			}
			if(localStorageExists()) {
				localStorage.setItem("positionsState", positionsCombined);
			}
			gtag('event', 'toggle_shadows');
		},
		toggleFaq: function(e) {
			e.preventDefault();
			var faqActive = !$(e.currentTarget).data("toggle-faq");
			$(e.currentTarget).data("toggle-faq", faqActive);
			if(faqActive) {
				$("main").append(_.template($("#template-faq").html())());
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
			var thisView = this;
			if(this.model.get("players")) {
				this.render();
			} else if(this.model.id == "players") {
				var thisModel = this.model;
				loadAllPlayers(function() {
					navView.collection.each(function(model) {
						if(_.contains(["ilb", "coffee2"], model.type())) {
							if(!thisModel.has("lineup")) {
								thisModel.set("lineup", []);
							}
							thisModel.set("lineup", _.union(thisModel.get("lineup"), model.get("lineup")));
							if(!thisModel.has("rotation")) {
								thisModel.set("rotation", []);
							}
							thisModel.set("rotation", _.union(thisModel.get("rotation"), model.get("rotation")));
							if(!thisModel.has("bench")) {
								thisModel.set("bench", []);
							}
							thisModel.set("bench", _.union(thisModel.get("bench"), model.get("bench")));
							if(!thisModel.has("bullpen")) {
								thisModel.set("bullpen", []);
							}
							thisModel.set("bullpen", _.union(thisModel.get("bullpen"), model.get("bullpen")));
							if(!thisModel.has("percolated")) {
								thisModel.set("percolated", []);
							}
							thisModel.set("percolated", _.union(thisModel.get("percolated"), model.get("percolated")));
							if(!thisModel.has("players")) {
								thisModel.set("players", new App.Collections.Players());
							}
							thisModel.get("players").add(model.get("players").models);
						}
					});
					thisView.render();
				});
			} else if(this.model.id == "tributes") {
				var HallCollection = new App.Collections.Tributes();
				HallCollection.fetch({
					success: function() {
						thisView.model.set("tributes", HallCollection.pluck("playerId"));
						var PlayersCollection = new App.Collections.Players();
						PlayersCollection.fetch({
							data: {
								ids: thisView.model.get("tributes").join(",")
							},
							success: function() {
								thisView.model.set("players", PlayersCollection);
								thisView.render();
							},
							error: console.log
						});
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
				var PlayersCollection = new App.Collections.Players();
				PlayersCollection.fetch({
					data: {
						ids: _.union(this.model.get("lineup"), this.model.get("rotation"), this.model.get("bench"), this.model.get("bullpen"), this.model.get("percolated")).join(",")
					},
					success: function() {
						thisView.model.set("players", PlayersCollection);
						thisView.render();
					},
					error: console.log
				});
			}
		},
		render: function() {
			var scrollPos;
			if($("section.players").length) {
				scrollPos = { x: $("section.players").scrollLeft(), y: $("section.players").scrollTop() };
			}
			this.$el.html(this.template(this.model));
			if(sortColumn) {
				$("[data-sort=" + sortColumn + "]").attr("data-direction", sortDirection);
			}
			if(scrollPos) {
				$("section.players").scrollLeft(scrollPos.x);
				$("section.players").scrollTop(scrollPos.y);
			}
		},
		events: {
			"click .summary-header > div, .stlats-header > div": "sortPlayers"
		},
		sortPlayers: function(e) {
			var sort = $(e.currentTarget).data("sort"), isReversed = _.contains(["name", "patheticism", "pressurization", "tragicness"], sort), scrollPos = { x: $("section.players").scrollLeft(), y: $("section.players").scrollTop() };
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
	
	//-- CHECK FOR SAVED DATA --
	if(localStorageExists()) {
		if(localStorage.getItem("lightModeState") != null) {
			lightMode = localStorage.getItem("lightModeState") == "true";
		}
		if(localStorage.getItem("shadowsState") !== null) {
			shadowsActive = localStorage.getItem("shadowsState") == "true";
		}
		if(localStorage.getItem("positionsState") !== null) {
			positionsCombined = localStorage.getItem("positionsState") == "true";
		}
	}
	//-- CHECKED FOR SAVED DATA --
	
	$("#root").toggleClass("dark", !lightMode);
	
	activeRouter = new App.Router;
	Backbone.history.start();
	
	function loadPage(team) {
		if(!navView) {
			navView = new App.Views.Nav({ collection: new App.Collections.Teams });
		}
		if(team) {
			if(team != activeTeam) {
				loadTeam(team);
				if(!footerView) {
					footerView = new App.Views.Footer();
				}
			}
		} else {
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
		}
	}
	
	function loadTeam(id) {
		activePage = id;
		if(navView.collection.length) {
			activeTeam = navView.collection.find(function(model) {
				return model.id == id || model.slug() == id;
			});
			if(teamView) {
				teamView.undelegateEvents();
			}
			teamView = new App.Views.Team({
				model: activeTeam
			});
		}
		loadPageView();
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
	
	function loadAllPlayers(callback) {
		var numProcessed = 0, filteredTeams = navView.collection.filter(function(model) {
			return _.contains(["ilb", "coffee2"], model.type());
		});
		_.each(filteredTeams, function(model) {
			var thisModel = model;
			if(model.get("players")) {
				numProcessed++;
				if(numProcessed >= filteredTeams.length && callback) {
					callback();
				}
			} else {
				var PlayersCollection = new App.Collections.Players();
				PlayersCollection.fetch({
					data: {
						ids: _.union(thisModel.get("lineup"), thisModel.get("rotation"), thisModel.get("bench"), thisModel.get("bullpen"), thisModel.get("percolated")).join(",")
					},
					success: function() {
						thisModel.set("players", PlayersCollection);
						numProcessed++;
						if(numProcessed >= filteredTeams.length && callback) {
							callback();
						}
					},
					error: console.log
				});
			}
		});
	}
	
	function parseEmoji(emoji) {
		return twemoji.parse(isNaN(Number(emoji)) ? emoji : twemoji.convert.fromCodePoint(emoji));
	}
	
	function scaleColorForRating(rating) {
		if(rating > 1.45) {
			return "class='stlat-super-elite'";
		} else if(rating > 1.15) {
			return "class='stlat-elite'";
		} else if(rating > 0.95) {
			return " class='stlat-exceptional'";
		} else if(rating > 0.85) {
			return " class='stlat-great'";
		} else if(rating > 0.65) {
			return " class='stlat-good'";
		}  else if(rating < 0.15) {
			return " class='stlat-terrible'";
		} else if(rating < 0.25) {
			return " class='stlat-bad'";
		} else if(rating < 0.45) {
			return " class='stlat-poor'";
		} 
		return "";
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