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
		twemoji: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/12.0.4/2/twemoji.min",
		jcanvas: "https://cdnjs.cloudflare.com/ajax/libs/jcanvas/21.0.1/min/jcanvas.min"
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
		},
		jcanvas: ["jquery"]
	}
});
//Start the main app logic.
requirejs(["jquery", "underscore", "backbone", "jcanvas"], function($, _, Backbone) {
	var App = {Models: {}, Collections: {}, Views: {}, Router: {}}, activeRouter, stadiumView, colors = { base: "#fff", dirt: "#c49463", fort: "#aaa", foul: "#fff", grass: "#4a8640", stroke: "#000" };
	
	//-- BEGIN ROUTER --
	App.Router = Backbone.Router.extend({
		routes: {
			"": "index"
		},
		index: function() {
			loadPage();
		}
	});
	//-- END ROUTER --
	
	//-- BEGIN MODELS --
	App.Models.Stadium = Backbone.Model.extend({
		parse: function(data) {
			return data.data;
		}
	});
	//-- END MODELS --
	
	//-- BEGIN COLLECTIONS --
	App.Collections.Stadiums = Backbone.Collection.extend({
		url: "https://api.sibr.dev/chronicler/v1/stadiums",
		model: App.Models.Stadium,
		comparator: function(model) {
			var stadiumName = model.get("name");
			return stadiumName.startsWith("The") ? stadiumName.substring(4) : stadiumName;
		},
		parse: function(data) {
			return data.data;
		}
	});
	//-- END COLLECTIONS --
	
	//-- BEGIN VIEWS --
	App.Views.Stadium = Backbone.View.extend({
		template: _.template($("#template-canvas").html()),
		el: "main",
		initialize: function() {
			var thisView = this;
			this.collection.fetch({
				success: function() {
					thisView.collection.sort("name");
					thisView.render();
				}
			});
		},
		render: function() {
			this.$el.html(this.template({ 
				fields: this.getFields(), 
				stadiums: this.collection
			}));
			this.resize();
		},
		getFields: function() {
			return ["grandiosity", "fortification", "obtuseness", "forwardness", "elongation"];
		},
		draw: function() {
			this.$el.find("canvas").clearCanvas();
			drawField(
				parseInt(this.$el.find("canvas").attr("height")), 
				parseInt(this.$el.find("canvas").attr("width")), 
				this.$el.find("[data-control=grandiosity] .input-number").val(), 
				this.$el.find("[data-control=fortification] .input-number").val(), 
				this.$el.find("[data-control=obtuseness] .input-number").val(), 
				this.$el.find("[data-control=forwardness] .input-number").val(), 
				this.$el.find("[data-control=elongation] .input-number").val()
			);
		},
		resize: function() {
			var canvasWidth = window.innerWidth, canvasHeight = window.innerHeight;
			this.$el.find("canvas").attr({
				height: canvasHeight,
				width: canvasWidth
			});
			this.draw();
		},
		events: {
			"input .input-slider": "changeSlider",
			"input .input-number": "changeNumber",
			"change .stadium-selector select": "loadStadiumStats"
		},
		changeSlider: function(e) {
			$(e.currentTarget).siblings(".input-number").val($(e.currentTarget).val() / 1000);
			this.$el.find("select").val("none");
			this.draw();
		},
		changeNumber: function(e) {
			var currentVal = $(e.currentTarget).val();
			if(currentVal < 0) {
				currentVal = 0;
			}
			if(currentVal > 1) {
				currentVal = 1;
			}
			$(e.currentTarget).val(currentVal);
			$(e.currentTarget).siblings(".input-slider").val(currentVal * 1000);
			this.$el.find("select").val("none");
			this.draw();
		},
		loadStadiumStats: function(e) {
			var thisView = this, foundStadium = this.collection.get($(e.currentTarget).val());
			if(foundStadium) {
				_.each(this.getFields(), function(field) {
					var fieldValue = Math.round(foundStadium.get(field) * 1000);
					thisView.$el.find("[data-control=" + field + "] .input-slider").val(fieldValue);
					thisView.$el.find("[data-control=" + field + "] .input-number").val(fieldValue / 1000);
				});
				thisView.draw();
			}
		}
	});
	//-- END VIEWS --
	
	//$("#root").toggleClass("dark", !lightMode);
	
	activeRouter = new App.Router;
	Backbone.history.start();
	
	window.onresize = function() {
		if(stadiumView) {
			stadiumView.resize();
		}
	};
	
	function loadPage() {
		if(stadiumView) {
			stadiumView.undelegateEvents();
		}
		stadiumView = new App.Views.Stadium({
			collection: new App.Collections.Stadiums
		});
	}

	function drawField(height, width, grandiosity, fortification, obtuseness, forwardness, elongation) {
		var scale = Math.min(height / 70, width / 70),
			stroke = Math.ceil(scale / 8),
			backstopOffset = 5 * scale,
			fortificationH = scale * 2 * (1 + fortification * 5) / 3,
			obtusenessAngle = (3 + obtuseness * 4) * Math.PI / 10,
			outfieldLength = backstopOffset + scale * 6 * (1 + grandiosity * 3),
			pathLength = 3 * scale * (2 + elongation * 3),
			elongationX = pathLength * Math.sin(obtusenessAngle / 2), 
			elongationY = pathLength * Math.cos(obtusenessAngle / 2),
			forwardnessY = (forwardness - 0.5) * elongationY,
			grandiosityX = (pathLength + outfieldLength) * Math.sin(obtusenessAngle / 2),
			grandiosityY = (pathLength + outfieldLength) * Math.cos(obtusenessAngle / 2),
			x = width / 2,
			y = (height + fortificationH + grandiosityY - elongationY) / 2;
		
		drawGrass(x, y, backstopOffset, elongationY, grandiosityX, grandiosityY);
		drawDirt(scale, x, y, y + forwardnessY, y + elongationY, x + elongationX, y - elongationY, x - elongationX, elongationY / 2, obtusenessAngle / 2, 2 * scale);
		drawFoulLine(x, y, elongationY, grandiosityX, grandiosityY, stroke);
		drawHomePlate(x, y + elongationY, scale * 17 / 15, stroke);
		drawBase(x + elongationX, y, scale, "right", stroke);
		drawBase(x, y - elongationY, scale, null, stroke);
		drawBase(x - elongationX, y, scale, "left", stroke);
		drawMound(x, y + forwardnessY, scale, stroke);
		drawFortifications(x, y, grandiosityX, elongationY + backstopOffset - grandiosityY, 2 * grandiosityY - backstopOffset, fortificationH);
	}

	function drawFortifications(x, y, fortificationX, fortificationY, fortificationC, fortificationH) {
		$("canvas").drawPath({
			fillStyle: colors.fort,
			p1: {
				type: 'quadratic',
				x1: x - fortificationX, y1: y + fortificationY,
				cx1: x, cy1: y - fortificationC,
				x2: x + fortificationX, y2: y + fortificationY
			},
			p2: {
				type: 'line',
				x2: x + fortificationX, y2: y + fortificationY - fortificationH
			},
			p3: {
				type: 'quadratic',
				cx1: x, cy1: y - fortificationC - fortificationH,
				x2: x - fortificationX, y2: y + fortificationY - fortificationH
			},
			closed: true
		});
	}

	function drawGrass(x, y, offset, elongationY, grandiosityX, grandiosityY) {
		$("canvas").drawPath({
			fillStyle: colors.grass,
			p1: {
				type: 'line',
				x1: x - grandiosityX, y1: y + elongationY + offset - grandiosityY,
				x2: x, y2: y + elongationY + offset,
				x3: x + grandiosityX, y3: y + elongationY + offset - grandiosityY
			},
			p2: {
				type: 'quadratic',
				cx1: x, cy1: y - 2 * grandiosityY + offset,
				x2: x - grandiosityX, y2: y + elongationY + offset - grandiosityY
			},
			closed: true
		});
	}

	function radToDeg(rad) {
		return rad / Math.PI * 180;
	}

	function drawDirt(scale, centerX, centerY, moundY, homeY, firstX, secondY, thirdX, infieldR, theta, radius) {
		// draw baseline
		$("canvas").drawLine({
			strokeStyle: colors.dirt,
			strokeWidth: 2 * scale / 3,
			x1: centerX, y1: homeY,
			x2: firstX, y2: centerY,
			x3: centerX, y3: secondY,
			x4: thirdX, y4: centerY,
			x5: centerX, y5: homeY,
			closed: true
		});
		// draw infied
		$("canvas").drawPath({
			fillStyle: colors.dirt,
			strokeStyle: colors.dirt,
			strokeWidth: 2 * scale / 3,
			p1: {
				type: 'line',
				x2: firstX, y2: centerY,
				x3: centerX, y3: secondY,
				x4: thirdX, y4: centerY,
				x5: thirdX - infieldR * Math.sin(theta), y5: centerY - infieldR * Math.cos(theta)
			},
			p2: {
				type: 'quadratic',
				cx1: centerX, cy1: secondY - 3 * infieldR,
				x2: firstX + infieldR * Math.sin(theta), y2: centerY - infieldR * Math.cos(theta)
			},
			closed: true
		})
		// draw mound
		$("canvas").drawArc({
			fillStyle: colors.dirt,
			x: centerX, y: moundY,
			radius: radius / 2
		}); 
		// draw home
		$("canvas").drawArc({
			fillStyle: colors.dirt,
			x: centerX, y: homeY - radius / 4,
			radius: radius
		});
		// draw first
		$("canvas").drawPath({
			fillStyle: colors.dirt,
			x: firstX, y: centerY,
			p1: {
				type: 'line',
				x1: 0, y1: 0
			},
			p2: {
				type: 'arc',
				start: radToDeg(-theta),
				end: radToDeg(Math.PI + theta),
				radius: radius,
				ccw: true
			},
			closed: true
		});
		// draw second
		$("canvas").drawPath({
			fillStyle: colors.dirt,
			x: centerX, y: secondY,
			p1: {
				type: 'line',
				x1: 0, y1: 0
			},
			p2: {
				type: 'arc',
				start: radToDeg(Math.PI - theta),
				end: radToDeg(Math.PI + theta),
				radius: radius
			},
			closed: true
		});
		// draw third
		$("canvas").drawPath({
			fillStyle: colors.dirt,
			x: thirdX, y: centerY,
			p1: {
				type: 'line',
				x1: 0, y1: 0
			},
			p2: {
				type: 'arc',
				start: radToDeg(theta),
				end: radToDeg(Math.PI - theta),
				radius: radius
			},
			closed: true
		});
	}

	function drawFoulLine(x, y, elongationY, grandiosityX, grandiosityY, width) {
		$("canvas").drawLine({
			strokeStyle: colors.foul,
			strokeWidth: width,
			x1: x - grandiosityX, y1: y - grandiosityY + elongationY,
			x2: x, y2: y + elongationY,
			x3: x + grandiosityX, y3: y - grandiosityY + elongationY,
			rounded: true
		});
	}

	function drawMound(x, y, size, width) {
		$("canvas").drawRect({
			strokeStyle: colors.stroke,
			strokeWidth: width,
			fillStyle: colors.base,
			x: x, y: y,
			width: size * 4 / 5,
			height: size * 2 / 5
		});
	}

	function drawBase(x, y, size, offset, width) {
		switch(offset) {
			case "left":
				offset = size / 2;
				break;
			case "right":
				offset = size / -2;
				break;
			default:
				offset = 0;
				break;
		}
		$("canvas").drawPath({
			strokeStyle: colors.stroke,
			strokeWidth: width,
			fillStyle: colors.base,
			p1: {
				type: 'line',
				x1: x - size / 2 + offset, y1: y,
				x2: x + offset, y2: y + size / 2,
				x3: x + size / 2 + offset, y3: y,
				x4: x + offset, y4: y - size / 2
			},
			closed: true
		});
	}

	function drawHomePlate(x, y, size, width) {
		$("canvas").drawPath({
			strokeStyle: colors.stroke,
			strokeWidth: width,
			fillStyle: colors.base,
			p1: {
				type: 'line',
				x1: x - size / 2, y1: y - size / 2,
				x2: x, y2: y,
				x3: x + size / 2, y3: y - size / 2,
				x4: x + size / 2, y4: y - size,
				x5: x - size / 2, y5: y - size
			},
			closed: true
		});
	}
});