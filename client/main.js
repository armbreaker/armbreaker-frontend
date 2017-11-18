"use strict";

document.addEventListener("DOMContentLoaded", init);

var dataset;

// Grouped rendering functions into classes for convenience
// the likes per day view
class PerDayView {
	constructor() {
		this.margin_top = 60;
		this.margin_bottom = 50;
		this.margin_w = 25;
		this.width  = 800 - this.margin_w * 2;
		this.height = 430 - this.margin_top - this.margin_bottom;
	}

	setup() {
		this.svg = d3.select("#perdayview");

		let alltimes = [];
		// find time ranges.
		this.mintime = "9999-08-25T06:27:00+00:00";
		this.maxtime = "0000-01-01T00:00:00+00:00";
		for (let postid in dataset.posts) {
			let post = dataset.posts[postid];
			for (let key in post.likes) {
				let time = post.likes[key];
				if (this.mintime > time) {
					this.mintime = time;
				} else if (this.maxtime < time) {
					this.maxtime = time;
				}
				alltimes.push(time);
			}
		}

		// extract likes per day.
		// first, initialize each day.
		let data = {};
		let oneday = moment.duration(1, "days");
		let startdate = getDate(this.mintime);
		let enddate = getDate(this.maxtime);
		while (startdate.clone().add(oneday) < enddate) {
			data[getDateString(startdate)] = 0;
			startdate.add(oneday);
		}
		data[getDateString(enddate)] = 0;

		for (let time of alltimes) {
			let day = getDate(time); // conversion puts dates into user timezone.
			let datestring = getDateString(day);
			data[datestring] += 1;
		}
		// flatten to ensure order.
		this.data = [];
		for (let date in data) {
			this.data.push([date, data[date]]);
		}
		this.data = this.data.sort((a, b)=>{
			if (a > b) return 1;
			if (a < b) return -1;
			return 0;
		});

		// also create sparkline data.
		this.totallikes = arrsum(this.data, d=>d[1]);
		this.sparkdata = [];
		let datanum = this.data.length;
		let sum = 0;
		let slope = this.totallikes / parseFloat(datanum);
		for (let i = 0; i < this.data.length; i++) {
			let date  = this.data[i][0];
			let likes = this.data[i][1];
			// compare expected likes versus actual likes
			// let diff = likes - slope; // likes vs average likes
			sum += likes;
			let diff = sum - (slope * (i+1));
			this.sparkdata.push([date, diff]);
		}
		this.sparkdataMagnitude = Math.abs(arrmax(this.sparkdata, d=>Math.abs(d[1]))[1]);

		// find new min and max times.
		this.mintime = this.data[0][0];
		this.maxtime = this.data[this.data.length - 1][0];

		// find max like magnitude, then create scales & axes
		this.maxlikes = arrmax(this.data, d=>d[1])[1];

		this.xscale = 
			d3.scaleBand()
			  .domain(this.data.map(d=>d[0]))
			  .paddingOuter(10)
			  .range([0, this.width]);
	    this.yscale = 
			d3.scaleLinear()
			  .domain([0, Math.floor(this.maxlikes * 1.05)])
			  .range([2, this.height]);
	    // have to invert scale for y axis
	    this.yscale_axis = this.yscale
	    	.copy()
	        .range([this.height, 1]);
        // scale for trend height.
		this.sparklinescale =
			d3.scaleLinear()
			  .domain([-this.sparkdataMagnitude, this.sparkdataMagnitude])
			  .range([this.margin_bottom / 2, -this.margin_bottom / 2]);

		this.xaxis =
			d3.axisBottom(this.xscale)
		this.yaxis =
			d3.axisLeft(this.yscale_axis);

		// draw axes
		this.svg.select(".all")
		    .attr("transform", `translate(${this.margin_w}, ${this.margin_top})`)
		this.svg.select(".bars");
		this.svg.select(".xaxis")
		    .call(this.xaxis)
		    .attr("transform", `translate(0, ${this.height})`);
		this.svg.select(".yaxis")
			.call(this.yaxis);

		this.sparkline = 
			d3.line()
			  .x(d=>this.xscale(d[0])+ this.xscale.bandwidth() / 2)
			  .y(d=>this.sparklinescale(d[1]));

	    // Create tooltip.
	    this.svg.select(".sparkline")
	    	.append("circle") // the dot on the sparkline
	    	.classed("tooltipDot", true)
	    	.classed("tooltip", true);
	    let tooltip = this.svg.select(".tooltiptext");
	    tooltip.style("display", "none");
	    tooltip
	    	.append("rect")
	    	.attr("width" , "100")
	    	.attr("height", "49")
	    	.attr("x", -50)
	    	.attr("y", -25)
	    	.attr("rx", 5)
	    	.attr("ry", 5);

		tooltip
		    .append("text")
	    	.classed("tooltipline1", true)
	    	.attr("y", -5);
	    tooltip
	    	.append("text")
	    	.classed("tooltipline2", true)
	    	.attr("y", 15);

	    this.svg.select(".all")
	    	.append("path")
	    	.classed("tooltipguide", true)
	    	.classed("tooltip", true);
	}

	update() {
		let sel = this.svg
			.select(".bars")
			.selectAll(".view1bars")
			.data(this.data);
		let myself = this;
		sel.enter()
		   .append("rect")
		   .classed("view1bars", true)
		   .attr("width", d=>this.xscale.bandwidth())
		   .attr("height", d=>this.yscale(d[1]))
		   .attr("x", d=>this.xscale(d[0]))
		   .attr("y", d=>this.height - this.yscale(d[1]))
		   .on("mouseover", function(d, i){
		   		myself.svg.selectAll(".tooltip").style("display", "inherit");

		   		let sparkline_y = myself.sparklinescale(myself.sparkdata[i][1]);
				myself.svg.select(".tooltipDot")
					.attr("cx", myself.xscale(d[0]) + myself.xscale.bandwidth() / 2)
					.attr("cy", sparkline_y)
					.attr("r" , 3);
				// distance from top of bar to sparkline.
				let y = myself.height - myself.yscale(d[1]);
				let x = myself.xscale(d[0]) + myself.xscale.bandwidth() / 2;
				let len = myself.yscale(d[1]) + (sparkline_y - myself.margin_bottom / 2);
				myself.svg.select(".tooltipguide")
					.attr("d", `M${x},${y}L${x},${myself.height + myself.margin_bottom}`);

				// need to find text width to center.
				let line1_w = getTextWidth(d[0], '"Open Sans" 12pt');
				let line2_w = getTextWidth(d[1] + " likes", '"Open Sans" 12pt');
				let align_left = line1_w - line2_w;
				myself.svg.select(".tooltipline1").text(d[0]);
				myself.svg.select(".tooltipline2").text(d[1] + " likes");

				// also move the entire tooltip
				myself.svg.select(".tooltiptext")
					.attr("transform", `translate(${x},${y - 30})`);
		   });
	    this.svg.select("rect")
	        .on("click", function(){
		   		myself.svg.selectAll(".tooltip").style("display", "none");
	        })
		// also add sparkline
		let sparkline = this.svg.select(".sparkline")
		    .attr("transform", `translate(0, ${this.height + this.margin_bottom / 2})`);
		sparkline
		    .append("line")
			.classed("normalline", true)
		    .attr("x1", 0)
		    .attr("x2", this.width)
		    .attr("y1", 0)
		    .attr("y2", 0);

		sparkline
			.append("path")
			.classed("dataline", true)
			.datum(this.sparkdata)
			.attr("d", this.sparkline);
	}
}

// the likes per chapter per user view, as well as chapter.
class UserView {
	constructor() {
		this.margin_top = 0;
		this.margin_bottom = 100;
		this.margin_w = 25;
		this.width  = 600 - this.margin_w * 2;
		this.height = 550 - this.margin_top - this.margin_bottom;
		this.tolerence = 0;
		this.algoname = "damerau";
		if (this.algoname == "damerau") {
			this.algo = damerau;
		} else {
			this.algo = levenshtein;
		}
		this.innerpadding = 7; // distance between clusters

		this.subgraph_height = 50;
		this.subgraph_margintop = 40;
	}

	setup() {
		this.svg = d3.select("#userview");
		this.userdata = {};
		this.userids = [];
		this.postids = [];
		this.likesperchapter = [];
		// put all users in userdata since need to cmp strings
		for (let userid in dataset.usersReferenced) {
			this.userids.push(userid);
			this.userdata[userid] = "";
		}
		// Need to tally likes per user, as well as chapter like sums
		for (let postid in dataset.posts) {
			let post = dataset.posts[postid];
			this.likesperchapter.push([postid, getKeys(post.likes).length]);
			this.postids.push(postid);
			for (let userid of this.userids) {
				if (userid in post.likes) {
					this.userdata[userid] += "x";
				} else {
					this.userdata[userid] += " ";
				}
			}
		}

		// Set tolerence to 10% of chapters or 2, whichever is larger.
		this.tolerence = Math.max(this.likesperchapter.length * 0.1, 5);

		this.userdata_arr = []
		for (let userid of this.userids) {
			this.userdata_arr.push([userid, this.userdata[userid]]);
		}

		// cluster similar likes, starting from the max "x"s
		this.clustered = [];
		let workingarr = this.userdata_arr.slice(0);

		let counter = this.userids.length - 1; // counter of users for arranging later.
		while(workingarr.length > 0) {
			// find a maximumally dense string.
			let el = arrmax(workingarr, (k)=>{
				return (k[1].match(/x/g) || []).length;
			});
			let i = workingarr.indexOf(el);
			let cluster = [[...el, counter--]];
			workingarr.splice(i, 1);
			for (i = 0; i < workingarr.length; i++) {
				let el2 = workingarr[i];
				if (this.algo(el[1], el2[1]) <= this.tolerence) {
					cluster.push([...el2, counter--]);
					workingarr.splice(i, 1);
					i--
				}
			}
			// also sort each cluster
			cluster.sort((a,b)=>{
				a = a[1];
				b = b[1];
				if (a > b) return 1;
				if (a < b) return -1;
				return 0;
			})
			this.clustered.push(cluster);
		}

		// set scale
		let domain = [];
		for (let j = 0; j < this.postids.length; j++) {
			domain.push(j);
		}

		this.xscale =
			d3.scaleBand()
			  .domain(domain)
			  //.paddingOuter(10)
			  .range([0, this.width]);
	    this.yscale = 
	    	d3.scaleLinear()
	    	  .domain([0, this.userids.length])
	    	  .range([0, this.height]);
	    // for subgraph
	    this.likesmax = arrmax(this.likesperchapter, d=>d[1])[1];
	    this.sub_yscale = 
	    	d3.scaleLinear()
	    	  .domain([0, this.likesmax])
	    	  .range([this.subgraph_height, 0]);

	    this.xaxis = 
	    	d3.axisBottom(this.xscale);

	    this.subyaxis =
	    	d3.axisLeft(this.sub_yscale)
	    	  .ticks(3);

		this.svg
			.select(".yaxis")
			.call(this.xaxis)
			.attr("transform", `translate(0, ${this.height + 2 + this.innerpadding * this.clustered.length})`)
			.append("text")
			.classed("axislabel", true)
			.attr("x", this.width - this.margin_w)
			.attr("y", 30)
			.text("Chapters");
		this.svg.select(".all")
			.attr("transform", `translate(${this.margin_w}, ${this.margin_top})`)
	}

	update() {
		let me = this;
		let clusters = this.svg
			.select(".bars")
			.selectAll(".cluster")
			.data(this.clustered);
		let clusterenter = clusters
			.enter()
			.append("g")
			.classed("cluster", true);		

		clusters = clusters.merge(clusterenter);

		clusters
			.attr("data-index", (d,i)=>i)
			.classed("odd", (d,i)=>i % 2 == 1)
			.classed("even", (d,i)=>i % 2 == 0);

		let bars = clusters
			.selectAll(".userbar")
			.data(d=>d);

		bars = bars.enter()
			.append("g")
			.classed("userbar", true)
			.merge(bars);

		bars.attr("transform", function(d){
			let i = +this.parentNode.getAttribute("data-index");
			return `translate(0, ${me.yscale(d[2]) + (me.clustered.length - i) * me.innerpadding})`
		});

		let sqrs = bars
			.selectAll(".barsquare", true)
			.data(d=>d[1]);
		sqrs = sqrs.enter()
			.append("rect")
			.classed("barsquare", true)
			.attr("width", this.xscale.bandwidth())
			.attr("height", this.yscale(1))
			.merge(sqrs);
		sqrs.attr("opacity", d=>d == "x" ? 1 : 0)
			.attr("x", (d,i)=>this.xscale(i))

		// add the rectangles to the rectangle div.
		let clusterboxes = 
			this.svg.select(".boxes")
				.selectAll(".clusterbox")
				.data(this.clustered);
		clusterboxes
			.enter()
			.append("rect")
			.classed("clusterbox", true)
			.classed("odd", (d,i)=>i % 2 == 1)
			.classed("even", (d,i)=>i % 2 == 0)
			.attr("transform", (d,i)=>`translate(0, ${(this.clustered.length - i)  * me.innerpadding})`)
			.attr("width", this.width)
			.attr("y", (d, i)=>{
				// y pos is equal to smallest y pos
				let el = arrmin(d, d=>this.yscale(d[2]));
				return this.yscale(el[2]);
			})
			.attr("height", (d,i)=>{
				// height is equal to diff between 
				// largest and smallest ypos
				let M = arrmax(d, d=>this.yscale(d[2]));
				let m = arrmin(d, d=>this.yscale(d[2]));
				return this.yscale(M[2]) - this.yscale(m[2]) + this.yscale(1);
			})
			.on("mouseover", function(d){
				d3.select("#userlistdiv").style("color", undefined);
				// user count
				d3.select("#numusers").text(d.length);
				let p = d.length / parseFloat(me.userids.length) * 100;
				p = n_digits(p, 1);
				d3.select("#percentusers").text(p);
				// like count
				let arr = d.map(el=>{
					return (el[1].match(/x/g) || []).length;
				});
				let average = arrsum(arr) / arr.length;
				d3.select("#averagelikes").text(n_digits(average, 1));
				p = average / me.likesperchapter.length * 100;
				d3.select("#percentliked").text(n_digits(p, 1));
				// append user list
				let usernames = 
					d.map(d=>dataset.usersReferenced[d[0]])
					 .sort((a, b)=>{
					 	a = a.toLowerCase();
					 	b = b.toLowerCase();
					 	if (a > b) return 1;
					 	if (a < b) return -1;
					 	return 0;
					 });

				d3.select("#userlist")
				  .html("")
				  .selectAll(".username")
				  .data(usernames)
				  .enter()
				  .append("span")
				  .classed("username", true)
				  .text(d=>d);
			});

		// populate like sub-graph 
		let band = this.xscale.bandwidth();
		let likeline = 
			d3.line()
			  .x((d,i)=>this.xscale(i) + band/2)
			  .y(d=>this.sub_yscale(d[1]));

		let likes = this.svg.select(".likegraph");
		let ypos = this.height + this.innerpadding * this.clustered.length + this.subgraph_margintop;
		likes.attr("transform", `translate(0, ${ypos})`)
		likes.append("path")
			.classed("likeline", true)
			.datum(this.likesperchapter)
			.attr("d", likeline);
		likes.append("line")
			.classed("bottomline", true)
			.attr("x1", this.xscale(0) + band/2)
			.attr("x2", this.xscale(this.likesperchapter.length - 1) + band/2)
			.attr("y1", this.sub_yscale(0) + 1)
			.attr("y2", this.sub_yscale(0) + 1);
		let subxaxis = 
			likes.append("g")
				.classed("subxaxis", true)
				.call(this.subyaxis)
				.attr("transform", "translate(12, 0)");
		subxaxis
			.append("text")
			.classed("label", true)
			.attr("text-anchor", "middle")
			.attr("x", this.width / 2 - 12)
			.attr("y", this.subgraph_height + 13)
			.text("Likes per chapter")
	}
}

// the likes over time for the first 24h view
class FirstImpressionsView {
	constructor() {

	}

	setup() {

	}

	update() {

	}
}

var views = [
	new PerDayView(),
	new UserView(),
	new FirstImpressionsView()
];

// Initialize everything.
function setup() {
	d3.select("#title h1").text(dataset.info.title);
	for (let view of views) {
		view.setup();
		view.update();
	}
}

function init() {
	d3.json("testdata.json", (err, data)=>{
		dataset = data;
		setup();
	});
}
