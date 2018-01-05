"use strict";

import Popper from "popper.js";
import {fully_in_view, in_view} from "in_view";

export default class FilterableDropdownModal {
	// Should be pairs of [value, text]
	constructor(data, selector) {
		this.data = data.map((d,i)=>[d[0], d[1], i]); // give unique ids
		this.selector = selector;
		this.d3sel = null;
		this.selected = null;
		this.selindex = -1;
		this.hovered = null;
		this.hoveredindex = -1; // hover index must go off of displayed elements only
		this.visible = false;
		this.callback = null;
		this.filter = null;
		this.props = {};

		this.modalpopper = null;
		this.toggle = null;
	}

	calculatedProperty(me, property, name) {
		let key = `${property}-${name}`;
		if (!(key in this.props)){
			let prop = window.getComputedStyle(me).getPropertyValue(property);
			this.props[key] = prop;
		}
		return this.props[key];
	}

	calcModalWidth(el) {
		let w    = this.calculatedProperty(el, "width", "modal");
		let bw_r = this.calculatedProperty(el, "border-width").split(" ")[1];
		return parseInt(w) - parseInt(bw_r) * 2;
	}

	calcHeight(me, name) {
		return this.calculatedProperty(me, "line-height", name);
	}

	changeHovered(key) {
		this.hoveredindex = this.boundindex(key);
		this.hovered = this.accessData(key);
		this.d3sel.selectAll(".filterabledropdown-hovered")
		   .classed("filterabledropdown-hovered", false);
		let el = this.d3sel
			.select(`.filterabledropdown-option[key="${key}"]`)
			.classed("filterabledropdown-hovered", true);
	}

	changeSelected(key){
		this.selindex = this.boundindex(key);
		this.selected = this.accessData(key);
		this.d3sel
			.selectAll(".filterabledropdown-prevselected")
			.classed("filterabledropdown-prevselected", false);
		this.d3sel
			.select(`.filterabledropdown-option[key="${key}"]`)
			.classed("filterabledropdown-prevselected", true);
		this.changeHovered(key);
		this.renderselected();
	}

	toggleModal(){
		this.visible = !this.visible;
		this.d3sel
			.select(".filterabledropdown-modal")
			.classed("filterabledropdown-hidden", !this.visible);
		if (this.visible) {
			this.d3sel
				.select(".filterabledropdown-filterbox")
				._groups[0][0].focus();
			this.modalpopper.scheduleUpdate();
			if (this.selindex != -1)
				this.keepInView(this.selindex);
		}
		this.toggle.text(this.visible?"▲":"▼");
	};

	keepInView(key) {
		let bounds = this.d3sel.select(".filterabledropdown-options")._groups[0][0];
		let option = this.d3sel.select(`.filterabledropdown-option[key="${key}"]`)._groups[0][0];
		if (this.hoveredindex != -1) {
			if (!fully_in_view(bounds, option)) {
				let filbox = this.d3sel.select(".filterabledropdown-filterbox")._groups[0][0];
				let style = getComputedStyle(filbox);
				let t = parseInt(style.marginTop) + parseInt(style.borderTop);
				let b = parseInt(style.marginBottom) + parseInt(style.borderBottom);
				bounds.scrollTop = option.offsetTop - option.offsetHeight - t - b;
			}
		}
	}

	// keep i within [-1, this.data.length)
	boundindex(i) {
		if (i < -1)
			i = -1;
		else if (i >= this.data.length)
			i = this.data.length - 1;
		return i;
	}

	// if -1, return null
	accessData(i) {
		if (i == -1)
			return null;
		return this.data[i];
	}

	renderFromIndex(hovered) {
		let i;
		if (hovered) {
			throw "Cannot use renderFromIndex for hover anymore"
			i = this.hoveredindex = this.boundindex(this.hoveredindex);
		} else {
			i = this.selindex = this.boundindex(this.selindex);
		}

		if (i == -1)
			this.selected = null
		else
			this.selected = this.data[i];
		this.renderselected();
	}

	renderselected() {
		d3.select(".filterabledropdown-selected")
		  .text(this.selected===null?"":this.selected[1])
		  ._groups[0][0].focus();
	}

	update(selector) {
		let sel = d3.select(selector)
			.select(".filterabledropdown-options")
			.selectAll("")
	}

	setup() {
		let me = this;
		let sel = d3.select(this.selector);
		this.d3sel = sel;
		sel = sel
			.append("div")
			.classed("filterabledropdown-container filterabledropdown-width", true);

		// selbox contains the dropdown toggle and the selected element
		let selbox = sel
			.append("div")
			.classed("filterabledropdown-width", true)
			.on("click", ()=>me.toggleModal())
			.attr("tabindex", 0)
			.on("keydown", function(){
				if (d3.event.key == "Enter")
					me.toggleModal();
				else if (d3.event.key == "ArrowDown") {
					me.changeSelected(me.selindex + 1);
					me.keepInView(me.selindex)
					d3.event.preventDefault();
				} else if (d3.event.key == "ArrowUp") {
					me.changeSelected(me.selindex - 1);
					me.keepInView(me.selindex)
					d3.event.preventDefault();
				}
			});
		// selected element
		let valuebox = selbox
			.append("div")
			.classed("filterabledropdown-selected filterabledropdown-padded", true)
			.attr("tabindex", -1)
			.style("height", function(){return me.calcHeight(this, "selected");})
			.text(this.selected===null?" ":this.selected[1]);
		this.toggle = selbox
			.append("div")
			.classed("filterabledropdown-toggle", true)
			.text(this.visible?"▲":"▼")
			.style("height", this.props["line-height-selected"])
			.style("width" , this.props["line-height-selected"]);
		let togglepopper = new Popper(selbox._groups[0][0], this.toggle._groups[0][0], {
			placement: "right",
			modifiers: {
				flip: {
					enabled: false
				},
				offset: {
					offset: `0px,-${parseInt(me.props["line-height-selected"])+1}px`
				}
			}
		}); 
		//// modal 
		let modal = sel
			.append("div")
			.classed("filterabledropdown-modal filterabledropdown-width", true)
			.classed("filterabledropdown-hidden", !this.visible);
		this.modalpopper = new Popper(selbox._groups[0][0], modal._groups[0][0], {
			placement: "bottom",
			modifiers: {
				flip: {
					enabled: false
				}
			}
		});
		modal
			.append("input")
			.classed("filterabledropdown-filterbox filterabledropdown-padded", true)
			.attr("type", "text")
			.style("height", function(){return me.calcHeight(this, "selected");})
			.on("keydown", function(){
				if (d3.event.key == "Enter") {
					me.changeSelected(me.hoveredindex)
					me.toggleModal();
				}
				else if (d3.event.key == "ArrowDown") {
					me.changeHovered(me.hoveredindex + 1);
					me.keepInView(me.hoveredindex);
					d3.event.preventDefault();
				} else if (d3.event.key == "ArrowUp") {
					me.changeHovered(me.hoveredindex - 1);
					me.keepInView(me.hoveredindex);
					d3.event.preventDefault();
				} else {
					// Do the filtering.
				}
			});
		modal
			.append("div")
			.classed("filterabledropdown-options", true)
			.selectAll(".filterabledropdown-option")
			.data(this.data)
			.enter()
			.append("div")
			.classed("filterabledropdown-option", true)
			.text(d=>d[1])
			.attr("key", d=>d[2])
			.style("height", function(){return me.calcHeight(this, "option")})
			.on("mouseenter", (d)=>me.changeHovered(d[2]))
			.on("click", function(d){
				d3.select(".filterabledropdown-modal")
				  .classed("filterabledropdown-hidden", true);
				d3.selectAll(".filterabledropdown-prevselected")
				  .classed("filterabledropdown-prevselected", false);
				d3.select(this)
				  .classed("filterabledropdown-prevselected", true);
				me.selected = d;
				me.renderselected();
				me.toggleModal();
			});
		modal
			.style("width", function(){return me.calcModalWidth(this)});
	}
}