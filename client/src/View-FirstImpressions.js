"use strict";

import * as d3 from "d3";
import * as util from "utility";
import timezones from "timezone-array";
import Dropdown from "FilterableDropdownModal";
import {DateTime, Duration} from "luxon";

// the likes over time for the first 24h view
export default class FirstImpressionsView { 
	constructor() {
		this.margin_top = 50; 
		this.margin_bottom = 30;
		this.margin_w = 55;
		this.width  = 800 - this.margin_w;
		this.height = 350 - this.margin_top - this.margin_bottom;
		this.markwidth = 50;
		this.markmargin = 5;
		this.scroll = 0; // amount scrolls
		this.terminalheight = 20; // how much below 48 hours to draw terminal width
		this.timezone = "utc";
		this.windowsize = 1; // in days
	}

	resize() {
		d3.select("#firstimpressionview").attr("width", window.innerWidth * .9);
	}

	// Regenerate shapes and axes
	generateShapes() {
		// Create scales and axes
		let totalduration = Duration.fromObject({days:this.windowsize * 2}).as("milliseconds");
		let onetick = Duration.fromObject({days:this.windowsize * 2}).as("milliseconds") / 24;
		this.yscale = d3.scaleLinear()
			.domain([0, totalduration])
			.range([0, this.height]);
		
		this.drawAxis()
		// Want to extract pertinent information
		let posts = this.dataset.posts.posts;
		let data = [];
		for (let post of posts) {
			let obj = {};
			obj.time = DateTime.fromISO(post.time, {zone:this.timezone});
			obj.title = post.title;
			let likes = [];
			for (let like_src of post.likes.likes) {
				let like_dst = {};
				like_dst.userid = like_src.user.id;
				like_dst.username = like_src.user.name;
				like_dst.time = like_src.time;
				likes.push(like_dst);
			}
			util.arrsort(likes, false, d=>d.time);
			for (let like of likes)
				like.time = DateTime.fromISO(like.time, {zone:this.timezone});
			obj.likes = likes;
			// find only likes that are within 24h
			for (let i = 0; i < obj.likes.length; i++) {
				let like = obj.likes[i];
				if (like.time.diff(obj.time).as("milliseconds") >= totalduration / 2) {
					obj.cappedlikes = obj.likes.slice(0, i);
					break;
				}
			}
			// Add one more like at the end of the timeframe
			obj.cappedlikes.push({userid:"", username:"", time:obj.time.plus(Duration.fromObject({milliseconds:totalduration / 2}))})
			// make area generator
			obj.markscale = d3.scaleLinear()
				.domain([0, obj.likes.length])
				.range([0, this.markwidth]);

			obj.areagen = d3.area()
				.x0((d,i)=>-0.5 * obj.markscale(i))
				.x1((d,i)=> 0.5 * obj.markscale(i))
				.y0((d,i)=>this.yscale(d.time.diff(obj.time).as("milliseconds")))
				.y1((d,i)=>this.yscale(d.time.diff(obj.time).as("milliseconds")));
			data.push(obj);
		}
		this.data = data;
	}

	setWindow(windowsize) {
		this.windowsize = windowsize;
		this.generateShapes();
	}

	drawAxis() {
		let totalduration = 2 * this.windowsize * 24 * 60 * 60 * 1000; // twice windowsize
		let onetick = totalduration / 24; // 2 days/24 in milliseconds
		let ticks = [];
		for (let i = 0; i < 24; i++) {
			ticks.push(i * onetick);
		}
		this.yaxis = d3.axisLeft(this.yscale)
			.tickValues(ticks)
			.tickFormat(d => {
				let dt = DateTime.
					fromISO("2015-01-01T00:00:00+00:00", {zone:this.timezone})
					.plus(Duration.fromMillis(d))
					.toFormat("HH");

				return `${Math.floor(d / 60 / 60 / 24 / 1000)}d ${dt}:00`;
			});

		this.svg.select(".yaxis")
		   .transition()
		   .call(this.yaxis);
	}

	// change timezone for axis (default UTC+0)
	setTimezone(timezone) {
		this.timezone = timezone;
		this.drawAxis();
	}

	// how many days after posting to track impressions of 
	setWindowSize(windowsize) {
		this.windowsize = windowsize;
		this.generateShapes();
	}

	setup(dataset) {
		let me = this;
		this.svg = d3.select("#firstimpressionview");
		this.dataset = dataset;
		this.xscale = i=>(this.markwidth + this.markmargin) * i + 0.5 * this.markwidth;
		// Populate timezone list.
		setTimeout(()=>{
			let timezonedata = timezones.map(d=>{
				let o = [d, null];
				let offset = DateTime.fromObject({year:2017, zone:d}).offset;
				if (Number.isNaN(offset))
					return null;
				let offsethrs = Math.floor(Math.abs(offset) / 60);
				let offsetmin = Math.floor(Math.abs(offset) % 60);
				let hrsstr = String(Math.abs(offsethrs)).padStart(2, 0);
				let minstr = String(Math.abs(offsetmin)).padStart(2, 0);
				if (offset >= 0)
					o[1] = `(UTC+${hrsstr}:${minstr}) ${d}`;
				else
					o[1] = `(UTC–${hrsstr}:${minstr}) ${d}`;
				return o;
			});
			timezonedata = timezonedata.filter(d=>d!=null)
			timezonedata = util.arrsort(timezonedata, false, d=>DateTime.fromObject({year:2017, zone:d[0]}).offset);
			let dropdown = new Dropdown(timezonedata, "#timezones");
			dropdown.setup();
			dropdown.setdefault_value("Etc/UTC");
			dropdown.callback = (d)=>this.setTimezone(d)
		}, 0)
		

		this.generateShapes();


		this.fillcolor = "rgba(255, 218, 96, 1.0)";
		// find max
		let max = util.arrmax(this.dataset.posts.posts, d=>d.likes.likes.length).likes.likes.length;
		let min = util.arrmin(this.dataset.posts.posts, d=>d.likes.likes.length).likes.likes.length;
		this.opacityscale = d3.scaleLinear()
			.domain([min, max])
			.range([0.2, 1.0]);

		// Initialize
		let svg = this.svg;
		svg.select(".all")
		   .attr("transform", `translate(${this.margin_w}, ${this.margin_top})`);

	    this.drag = d3.drag()
	    	.on("drag", d=>{
	    		this.scroll += d3.event.dx;
	    		this.svg
	    			.select(".marks_drag")
	    			.attr("transform", `translate(${this.scroll}, 0)`);
	    	})

	    svg.select(".drag_hitbox")
	       .call(this.drag);

        // adding slider...
		this.binsizes    = [1, 2, 3, 7, 14];
		this.sliderticks = [1, 2, 3, 7, 14];
		var sliderFromBin = val=>{
			let i = this.binsizes.indexOf(val);
			return this.sliderticks[i];
		}

		var binFromSlider = val=>{
			let i = this.sliderticks.indexOf(val);
			return this.binsizes[i];
		}

		let slidertickformat = (d)=>{
			d = binFromSlider(d);
			if (d <= 2)
				return (d * 24) + " hours";
			return d + " days";
		}

    	this.slider = d3
    		.slider()
    		.min(this.sliderticks[0])
    		.max(this.sliderticks[this.sliderticks.length - 1])
    		.tickValues(this.sliderticks)
    		.stepValues(this.sliderticks)
    		.value(sliderFromBin(this.binsize))
    		.tickFormat(slidertickformat)
    		.callback(()=>{
    			let val = this.slider.value();
    			me.svg.select(".tooltip").style("display", "none")
    			val = binFromSlider(val);
	    		this.setWindowSize(val);
	    		this.update();
	    	});

	    // Hook up controls.
	    d3.select("#firstimpressions_windowslider")
    	  .call(this.slider);
	}

	// take in chapter obj, return area path for longtail. 
	drawLongtail(datum) {
		// Areagen mirrors right sided to left.
		let a = d3.area()
			.x0(d=>-d[0])
			.x1(d=>d[0])
			.y0(d=>d[1])
			.y1(d=>d[1])
			.curve(d3.curveBasis);
		let numlikes = datum.cappedlikes.length;
		let lastlike = datum.cappedlikes[numlikes - 1];
		let tail_start = this.yscale(lastlike.time.diff(datum.time).as("milliseconds"));
		let time_above_cap = datum.time.diff(datum.time.startOf("day")).as("milliseconds");
		let tail_end = this.yscale(Duration.fromObject({day:this.windowsize * 2}).as("milliseconds") - time_above_cap);
		let half_width = datum.markscale(numlikes) * 0.5;
		let half_final = 0.5 * this.markwidth;

		return a([
			[half_width, tail_start],
			[half_width * 0.8 + half_final * 0.2, tail_end * 0.7 + tail_start * 0.3],
			[half_final, tail_end + this.terminalheight]
		]);
	}

	update() {
		let me = this;
		let sel = this.svg.select(".marks")
			.selectAll(".mark")
			.data(this.data, (d,i)=>i);
		sel.exit().remove();
		let enter = sel.enter()
		   .append("g")
		   .classed("mark", true);
		enter
			.append("path")
			.classed("longtail", true);
		enter
			.append("path")
			.classed("markpath", true);
		enter
			.append("circle")
			.classed("markcap", true)
	       .attr("cx", 0)
	       .attr("cy", 0)
	       .attr("r", 2.5)

		sel = enter.merge(sel);
		sel
			.transition()
		    .attr("transform", (d,i)=>{
		   		let dur = d.time.diff(d.time.startOf("day")).as("milliseconds");
		   		return `translate(${this.xscale(i)},${this.yscale(dur)+4})`;
			})
		sel
			.on("mouseenter", function(d, i){
		   		let dur = d.time.diff(d.time.startOf("day")).as("milliseconds");
				d3.select(this)
				  .select(".markpath")
				  .style("stroke-width", "2px");
				let g = me.svg
				  .select(".tooltip")
				  .style("display", null)
				  .attr("transform", `translate(${me.xscale(i)},${me.yscale(dur)-4})`);
				g
				  .select(".line1")
				  .text(d.title);
			    g
				  .select(".line2")
				  .text(`(${d.likes.length})`);
			})
			.on("mouseout", function(){
				d3.select(this)
				  .select(".markpath")
				  .style("stroke-width", null);	
			})
			.each(function(d){
				let el = d3.select(this);
				el
					.select(".longtail")
					.attr("d", me.drawLongtail(d));
				let fill = d3.hsl(me.fillcolor);
				fill.opacity = me.opacityscale(d.likes.length);
				fill.s = me.opacityscale(d.likes.length);
				el
					.select(".markpath")
					.attr("d", d.areagen(d.cappedlikes))
					.style("fill", fill)
			});
	}
}