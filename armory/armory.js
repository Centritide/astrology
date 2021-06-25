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
requirejs(["jquery", "underscore", "backbone", "twemoji", "json!../blaseball/astrology.json", "json!../blaseball/modifiers.json"], function($, _, Backbone, twemoji, attributes, modifiers) {
	var App = {Models: {}, Collections: {}, Views: {}, Router: {}}, activeRouter, activePage, navView, globalTeams, globalPlayers, 
	globalItems, descAttributes = _.chain(attributes.categories).reduce(function(c, d) { return _.union(c, d.attributes); }, []).where({ "direction": "desc" }).pluck("id").union(["name", "team", "position", "peanutAllergy", "rank"]).value(), mainView, footerView, sortColumn = null, sortDirection = null, lightMode = false;
	
	//-- BEGIN ROUTER --
	App.Router = Backbone.Router.extend({
		routes: {
			"": "index"
		},
		index: function() {
			loadAssets();
		}
	});
	//-- END ROUTER --
	
	//-- BEGIN MODELS --
	App.Models.Nav = Backbone.Model.extend({});
	App.Models.Footer = Backbone.Model.extend({
		lightEmoji: function() {
			return parseEmoji(lightMode ? 0x1F506 : 0x1F311);
		},
		isLightMode: function() {
			return lightMode;
		}
	});
	App.Models.Team = Backbone.Model.extend({
		emoji: function() {
			return parseEmoji(this.get("emoji"));
		},
		type: function() {
			switch(this.id) {
				case "all":
				case "squeezer":
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
				case "88151292-6c12-4fb8-b2d6-3e64821293b3": // alaskan immortals
				case "d6a352fc-b675-40a0-864d-f4fd50aaeea0": // canada artists
				case "54d0d0f2-16e0-42a0-9fff-79cfa7c4a157": // antarctic fireballs
				case "71c621eb-85dc-4bd7-a690-0c68c0e6fb90": // downward dogs
				case "9494152b-99f6-4adb-9573-f9e084bc813f": // baltimore clabs
				case "a4b23784-0132-4813-b300-f7449cb06493": // phoenix trunks
					return "ulb";
				default:
					return "ilb";
			}
		}
	});
	App.Models.Player = Backbone.Model.extend({
		parse: function(data) {
			return data.data;
		},
		canonicalName: function() {
			if(!_.isEmpty(this.get("state")) && _.has(this.get("state"), "unscatteredName")) {
				return this.get("state").unscatteredName;
			}
			return this.get("name");
		},
		team: function() {
			if(this.get("deceased")) {
				return parseEmoji(0x1F3DB);
			}
			if(_.contains(this.modifications(), "LEGENDARY") && !_.contains(this.modifications(), "REPLICA") || _.contains(this.modifications(), "DUST")) {
				return parseEmoji(0x1F3C6);
			}
			var team = globalTeams.get(this.get("leagueTeamId"));
			if(!team) {
				team = globalTeams.get(this.get("tournamentTeamId"));
			}
			if(team) {
				return team.emoji();
			}
			return "";
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
			return null;
		},
		modifications: function() {
			return _.union(this.get("permAttr"), this.get("itemAttr"), this.get("seasAttr"), this.get("weekAttr"), this.get("gameAttr"));
		}
	});
	App.Models.Item = Backbone.Model.extend({
		parse: function(data) {
			return data.data;
		},
		emoji: function() {
			var emoji;
			switch(this.get("root").name) {
				case "Base":
					emoji = "0x1F539";
					break;
				case "Bat":
					emoji = "0x1F3CF";
					break;
				case "Board":
					emoji = "0x1F6F9";
					break;
				case "Broom":
					emoji = "0x1F9F9";
					break;
				case "Cannon":
					emoji = "0x1F52B";
					break;
				case "Cap":
					emoji = "0x1F9E2";
					break;
				case "Cape":
					emoji = "0x1F9E3";
					break;
				case "Field":
					emoji = "0x1F535";
					break;
				case "Glove":
					emoji = "0x1F9E4";
					break;
				case "Helmet":
					emoji = "0x1FA96";
					break;
				case "Jersey":
					emoji = "0x1F455";
					break;
				case "Necklace":
					emoji = "0x1F4FF";
					break;
				case "Phone":
					emoji = "0x260E";
					break;
				case "Pillow":
					emoji = "0x1F411";
					break;
				case "Potion":
					emoji = "0x2697";
					break;
				case "Quill":
					emoji = "0x1FAB6";
					break;
				case "Ring":
					emoji = "0x1F48D";
					break;
				case "Socks":
					emoji = "0x1F9E6";
					break;
				case "Shoes":
					emoji = "0x1F45F";
					break;
				case "Sunglasses":
					emoji = "0x1F576";
					break;
				default:
					emoji = "0x2753";
					break;
			}
			return parseEmoji(emoji);
		},
		elements: function() {
			return _.chain(this.get("prefixes") || [])
				.concat([this.get("prePrefix"), this.get("postPrefix"), this.get("suffix")])
				.compact()
				.pluck("name")
				.countBy()
				.pairs()
				.map(function(pair) {
					return pair[0] + (pair[1] > 1 ? " x" + pair[1] : "");
				})
				.value();
		},
		modifications: function() {
			return _.chain(this.get("prefixes") || [])
				.concat([this.get("prePrefix"), this.get("postPrefix"), this.get("root"), this.get("suffix")])
				.compact()
				.pluck("adjustments")
				.flatten()
				.where({ type: 0 })
				.map(function(adjustment) { 
					var modifier = getModifier(adjustment.mod), description = "";
					if(modifier.description) {
						description = " - " + ((modifier.descriptions && modifier.descriptions.player) ? modifier.descriptions.player : modifier.description);
					}
					return "<span title=\"" + modifier.title + description + "\">" + parseEmoji(modifier.emoji) + "</span>";
				})
				.value();
		},
		adjustments: function() {
			var attributes = ["tragicness", "buoyancy", "thwackability", "moxie", "divinity", "musclitude", "patheticism", "martyrdom", "cinnamon", "baseThirst", "laserlikeness", "continuation", "indulgence", "groundFriction", "shakespearianism", "suppression", "unthwackability", "coldness", "overpowerment", "ruthlessness", "pressurization", "omniscience", "tenaciousness", "watchfulness", "anticapitalism", "chasiness"];
			return _.chain(this.get("prefixes"))
				.concat([this.get("prePrefix"), this.get("postPrefix"), this.get("root"), this.get("suffix")])
				.compact()
				.pluck("adjustments")
				.flatten()
				.where({ type: 1 })
				.reduce(function(a, b) {
					var name = attributes[b.stat];
					a[name] = _.get(a, name, 0) + b.value;
					return a;
				}, {})
				.value();
		}
	});
	//-- END MODELS --
	
	//-- BEGIN COLLECTIONS --
	App.Collections.Teams = Backbone.Collection.extend({
		url: "https://api.sibr.dev/corsmechanics/www.blaseball.com/database/allTeams",
		model: App.Models.Team
	});
	App.Collections.Players = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v2/entities",
		model: App.Models.Player,
		parse: function(data) {
			return data.items
		},
		fetchPage: function(count, next, success) {
			this.fetch({
				reset: !next,
				remove: !next,
				data: {
					type: "player",
					count: count,
					page: next
				},
				success: success,
				error: console.log
			});
		}
	});
	App.Collections.Items = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v2/entities",
		model: App.Models.Item,
		parse: function(data) {
			return data.items;
		},
		fetchPage: function(count, next, success) {
			this.fetch({
				reset: !next,
				remove: !next,
				data: {
					type: "item",
					count: count,
					page: next
				},
				success: success,
				error: console.log
			});
		}
	});
	//-- END COLLECTIONS --
	
	//-- BEGIN VIEWS --
	App.Views.Nav = Backbone.View.extend({
		template: _.template($("#template-placeholder").html()),
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
				if(localStorage.getItem("active_state") !== null) {
					this.model.set("active", localStorage.getItem("active_state") == "true");
				}
				if(localStorage.getItem("inactive_state") !== null) {
					this.model.set("inactive", localStorage.getItem("inactive_state") == "true");
				}
				if(localStorage.getItem("bargain_bin_state") !== null) {
					this.model.set("bargain_bin", localStorage.getItem("bargain_bin_state") == "true");
				}
			}
			this.render();
		},
		render: function() {
			this.$el.html(this.template({ model: this.model }));
		},
		events: {
			"change input[data-toggle]": "toggleCheckbox",
			"click a[data-toggle-lights]": "toggleLights"
		},
		toggleCheckbox: function(e) {
			var type = $(e.currentTarget).data("toggle"), isChecked = $(e.currentTarget).prop("checked");
			this.model.set(type, isChecked);
			if(localStorageExists()) {
				localStorage.setItem(type + "_state", isChecked);
			}
			if(mainView) {
				mainView.render();
			}
			gtag('event', 'toggle_' + type);
		},
		toggleLights: function(e) {
			e.preventDefault();
			lightMode = !$(e.currentTarget).data("toggle-lights");
			$(e.currentTarget).data("toggle-lights", lightMode);
			$("#root").addClass("transition");
			$("#root").toggleClass("dark", !lightMode);
			$(e.currentTarget).html(this.model.lightEmoji());
			if(localStorageExists()) {
				localStorage.setItem("lightModeState", lightMode);
			}
			gtag('event', 'toggle_lights');
		}
	});
	App.Views.Items = Backbone.View.extend({
		template: _.template($("#template-items").html()),
		el: "main",
		initialize: function() {
			this.render();
		},
		render: function() {
			var chain = globalItems.chain(), scrollPos;
			if(this.$el.find("section.items").length) {
				scrollPos = { x: this.$el.find("section.items").scrollLeft(), y: this.$el.find("section.items").scrollTop() };
			}
			if(!isBargainBinShown()) {
				chain = chain.filter(function(item) {
					return (item.get("owners") || []).length;
				});
			}
			if(!isInactiveShown()) {
				chain = chain.reject(function(item) {
					return _.chain(item.get("owners") || []).map(function(player) {
						return player.position();
					}).intersection(["Shadows", null]).value().length;
				});
			}
			if(!isActiveShown()) {
				chain = chain.reject(function(item) {
					return _.chain(item.get("owners") || []).map(function(player) {
						return player.position();
					}).intersection(["Lineup", "Rotation"]).value().length;
				});
			}
			if(sortColumn) {
				chain = chain.sortBy(function(item) {
					switch(sortColumn) {
						case "durability":
							return item.get("durability") < 0 ? Infinity : item.get("health");
						case "elements":
							return _.reduce(item.elements(), function(e, f) {
								var matcher = f.match(/.+ x(\d+)$/i);
								return e + (matcher ? parseInt(matcher[1]) : 1);
							}, 0);
						case "name":
							return item.get("name");
						case "modifications":
							return (item.modifications() || []).length;
						case "owners":
							return (item.get("owners") || []).length;
						default:
							return _.get(item.adjustments(), sortColumn, 0);
					}
				});
				if(sortDirection == "desc") {
					chain = chain.reverse();
				}
			}
			this.$el.html(this.template({
				columns: _.reject(attributes.categories, function(category) {
					return category.id === "misc";
				}),
				items: chain.value(),
				scale: function(value) {
					if(value > 0.5) {
						return "stat-plus-plus-plus";
					} else if(value > 0.25) {
						return "stat-plus-plus";
					} else if(value > 0) {
						return "stat-plus";
					} else if(value == 0) {
						return "stat-zero";
					} else if(value < -0.5) {
						return "stat-minus-minus-minus";
					} else if(value < -0.25) {
						return "stat-minus-minus";
					} else if(value < 0) {
						return "stat-minus";
					}
				}
			}));
			if(sortColumn) {
				this.$el.find("[data-sort=" + sortColumn + "]").attr("data-direction", sortDirection);
			}
			if(scrollPos) {
				this.$el.find("section.items").scrollLeft(scrollPos.x);
				this.$el.find("section.items").scrollTop(scrollPos.y);
			}
		},
		events: {
			"click th": "sortItems"
		},
		sortItems: function(e) {
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
	
	function loadAssets() {
		var count = 1000;
		if(!globalTeams) {
			globalTeams = new App.Collections.Teams();
			globalTeams.fetch({
				success: function() {
					loadItemsPage();
				},
				error: console.log
			});
		}
		if(!globalPlayers) {
			globalPlayers = new App.Collections.Players();
			var playersSuccess = function(collection, response) {
				if(response.nextPage) {
					collection.fetchPage(count, response.nextPage, playersSuccess);
				} else {
					loadItemsPage();
				}
			};
			globalPlayers.fetchPage(count, null, playersSuccess);
		}
		if(!globalItems) {
			globalItems = new App.Collections.Items();
			var itemsSuccess = function(collection, response) {
				if(response.nextPage) {
					collection.fetchPage(count, response.nextPage, itemsSuccess);
				} else {
					loadItemsPage();
				}
			};
			globalItems.fetchPage(count, null, itemsSuccess);
		}
	}

	function loadItemsPage() {
		if(globalTeams.length && globalPlayers.length && globalItems.length) {
			setItemOwners();
			mainView = new App.Views.Items({
				collection: globalItems
			});
			if(!footerView) {
				footerView = new App.Views.Footer({
					model: new App.Models.Footer({
						active: true,
						inactive: true,
						bargain_bin: true
					})
				});
			}
			loadPageView();
		}
	}

	function setItemOwners() {
		globalPlayers.each(function(player) {
			_.each(player.get("items"), function(item) {
				var itemId = _.isObject(item) ? item.id : item, foundItem = globalItems.findWhere({ id: itemId });
				if(foundItem) {
					foundItem.set("owners", _.union(foundItem.get("owners"), [player]));
				}
			});
		});
	}
	
	function loadPageView() {
		var title = "Armory", path = "/";
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
	
	function isActiveShown() {
		return footerView ? footerView.model.get("active") : $("[data-toggle=active]").prop("checked");
	}
	
	function isInactiveShown() {
		return footerView ? footerView.model.get("inactive") : $("[data-toggle=inactive]").prop("checked");
	}
	
	function isBargainBinShown() {
		return footerView ? footerView.model.get("bargain_bin") : $("[data-toggle=bargain_bin]").prop("checked");
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