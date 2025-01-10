Module.register("MMM-FroniusSolar2", {
    defaults: {
        updateInterval: 60000, // Update every 60 seconds
        icons: {
            P_Akku: "mdi:car-battery",
            P_Grid: "mdi:transmission-tower",
            P_Load: "mdi:home-lightbulb",
            P_PV: "mdi:solar-panel-large",
        },
        Radius: 80, // Radius for the SVG gauges
        MaxPower: 1000, // Maximum power for grid, house, and battery
        MaxPowerPV: 10400, // Maximum power for solar PV
	ShowText: true,
        TextMessge: [
            { about: "600", Text: "Leicht erhöhter Netzbezug.", color: "#999" },
            { about: "1000", Text: "Über 1 KW Netzbezug!", color: "#ffffff" },
            { about: "1500", Text: "Über 1,5KW Netzbezug.", color: "#eea205" },
            { about: "2500", Text: "Über 2,5KW aus dem Netz!", color: "#ec7c25" },
            { about: "5000", Text: "Auto lädt, richtig? Nächstes Mal auf Sonne warten.", color: "#cc0605" },
            { less: "-500", Text: "Sonne scheint! Mehr als 500W frei.", color: "#f8f32b" },
            { less: "-2000", Text: "Wäsche waschen! Über 2KW freie Energie!", color: "#00bb2d" },
            { less: "-4000", Text: "Auto laden! Über 4KW freie Energie!", color: "#f80000" },
        ],
    },

    start: function () {
        this.solarData = null;
        this.solarSOC = 0; // Default SOC
        this.sendSocketNotification("GET_FRONIUS_DATA");
        this.scheduleUpdate();
    },

    getStyles: function () {
        return ["MMM-FroniusSolar2.css", "https://code.iconify.design/2/2.2.1/iconify.min.js"];
    },

    scheduleUpdate: function () {
        const self = this;
        setInterval(function () {
            self.sendSocketNotification("GET_FRONIUS_DATA");
        }, this.config.updateInterval);
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "FRONIUS_DATA") {
            this.solarData = {
                P_Akku: Math.round(payload.P_Akku || 0),
                P_Grid: Math.round(payload.P_Grid || 0),
                P_Load: Math.round(payload.P_Load || 0),
                P_PV: Math.round(payload.P_PV || 0),
            };
            this.solarSOC = payload.Inverters && payload.Inverters["1"] && payload.Inverters["1"].SOC
                ? Math.round(payload.Inverters["1"].SOC)
                : 0; // Fallback to 0 if SOC is undefined
            this.updateDom();
        }
    },

    getDom: function () {
        const wrapper = document.createElement("div");
        wrapper.className = "solar2-wrapper";

        if (!this.solarData) {
            wrapper.innerHTML = "Loading...";
            return wrapper;
        }

        const radius = this.config.Radius || 80;
        const strokeWidth = 12;
        const svgSize = 350; // Adjusted SVG height for labels and padding

        // Recalculate house consumption
        const outerPower = this.solarData.P_Grid + this.solarData.P_Akku + this.solarData.P_PV;

        // Fixed positions for the gauges in dice layout
        const positions = {
            PV: { x: 75, y: 75 },
            Grid: { x: 225, y: 75 },
            Akku: { x: 75, y: 225 },
            House: { x: 225, y: 225 }
        };

        // Define colors for gauges
        const gridColor = this.solarData.P_Grid >= 0 ? "#808080" : "#add8e6"; // Gray for positive, light blue for negative
        const akkuColor = "#00ff00"; // Always green
        const pvColor = "#ffff00"; // Always yellow

        // House Gauge: Logic for color determination
        let houseColor;
        if (this.solarData.P_Akku - 100 > Math.abs(this.solarData.P_Grid)) {
            houseColor = "#a3c49f"; // Light green for high battery activity
        } else if (this.solarData.P_Grid > 150) {
            houseColor = "#808080"; // Gray for high grid consumption
        } else if (outerPower > 0) {
            houseColor = "#00ff00"; // Green for positive power flow
        } else {
            houseColor = "#1f84ff"; // Light blue
        }

        // Create unified SVG
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", svgSize);
        svg.setAttribute("height", svgSize);
        svg.setAttribute("viewBox", "0 -20 300 350"); // Adjusted viewBox to fix label cutoff
	svg.style.margin = "auto"; // Center the SVG


        // Define glow effect
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        defs.innerHTML = `
            <filter id="glow">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blurred" />
                <feMerge>
                    <feMergeNode in="blurred" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        `;
        svg.appendChild(defs);

        // Function to create a line
        const createLine = (x1, y1, x2, y2, color) => {
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x1);
            line.setAttribute("y1", y1);
            line.setAttribute("x2", x2);
            line.setAttribute("y2", y2);
            line.setAttribute("stroke", color);
            line.setAttribute("stroke-width", "4");
            line.setAttribute("class", "flow-lines");
            return line;
        };

        // Add flow lines
        if (this.solarData.P_Akku < -10 && this.solarData.P_PV > 0 ) {
            svg.appendChild(createLine(positions.PV.x, positions.PV.y + radius, positions.Akku.x, positions.Akku.y - radius, "#ffff00"));
        }
        if (this.solarData.P_PV > 10) {
            svg.appendChild(createLine(positions.PV.x + (radius * 0.7071), positions.PV.y + (radius * 0.7071), positions.House.x - (radius * 0.7071), positions.House.y - (radius * 0.7071), "#ffff00"));
        }
        if (this.solarData.P_Grid > 10) {
            svg.appendChild(createLine(positions.Grid.x, positions.Grid.y + radius, positions.House.x, positions.House.y - radius, "#808080"));
        }
        if (this.solarData.P_Akku > 10) {
            svg.appendChild(createLine(positions.Akku.x + radius, positions.Akku.y, positions.House.x - radius, positions.House.y, "#00ff00"));
        }
        if (this.solarData.P_Grid < -10 && this.solarData.P_PV > Math.abs(this.solarData.P_Grid)) {
            svg.appendChild(createLine(positions.PV.x + radius, positions.PV.y, positions.Grid.x - radius, positions.Grid.y, "#add8e6"));
        }
        if (this.solarData.P_Grid < -10 && this.solarData.P_PV <= 0) {
            svg.appendChild(createLine(positions.Akku.x + (radius * 0.7071), positions.Akku.y - (radius * 0.7071), positions.Grid.x - (radius * 0.7071), positions.Grid.y + (radius * 0.7071), "#00ff00"));
        }
	 if (this.solarData.P_PV <= 0 && this.solarData.P_Akku < -10) {
            svg.appendChild(createLine(positions.Grid.x - (radius * 0.7071), positions.Grid.y + (radius * 0.7071), positions.Akku.x + (radius * 0.7071), positions.Akku.y - (radius * 0.7071), "#808080"));
        }



        // Function to create a gauge
        const createGauge = (x, y, mainValue, subValue, percentage, color, label, icon, labelPosition) => {
            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.setAttribute("transform", `translate(${x},${y})`);

            // Circle Background
            const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            bgCircle.setAttribute("cx", 0);
            bgCircle.setAttribute("cy", 0);
            bgCircle.setAttribute("r", radius);
            bgCircle.setAttribute("stroke", "#e0e0e0");
            bgCircle.setAttribute("opacity", "1");
	    bgCircle.setAttribute("stroke-width", strokeWidth);
            bgCircle.setAttribute("fill", "none");
            group.appendChild(bgCircle);

            // Circle Progress with glow
            const progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            progressCircle.setAttribute("cx", 0);
            progressCircle.setAttribute("cy", 0);
            progressCircle.setAttribute("r", radius);
            progressCircle.setAttribute("stroke", color);
            progressCircle.setAttribute("stroke-width", strokeWidth);
            progressCircle.setAttribute("fill", "none");
            progressCircle.setAttribute("stroke-dasharray", `${percentage * 2 * Math.PI * radius} ${2 * Math.PI * radius}`);
            progressCircle.setAttribute("transform", "rotate(-90 0 0)");
            progressCircle.setAttribute("filter", "url(#glow)"); // Apply glow filter
            group.appendChild(progressCircle);

            // Main Text
            const mainText = document.createElementNS("http://www.w3.org/2000/svg", "text");
            mainText.setAttribute("x", 0);
            mainText.setAttribute("y", 6); // Adjusted y position for main text
            mainText.setAttribute("text-anchor", "middle");
            mainText.setAttribute("font-size", "22px");
            mainText.setAttribute("fill", "#ffffff");
            mainText.textContent = mainValue;
            group.appendChild(mainText);

            // Sub Text
            if (subValue) {
                const subText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                subText.setAttribute("x", 0);
                subText.setAttribute("y", 25); // Adjusted y position for sub text
                subText.setAttribute("text-anchor", "middle");
                subText.setAttribute("font-size", "16px");
                subText.setAttribute("fill", "#ffffff");
                subText.textContent = subValue;
                group.appendChild(subText);
            }

            // Label with foreignObject for icon
            const labelY = labelPosition === "top" ? -(radius + 45) : radius + 15; // Increased offset for top labels
            const labelContainer = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
            labelContainer.setAttribute("x", -radius-20);
            labelContainer.setAttribute("y", labelY);
	    labelContainer.setAttribute("text-anchor", "middle");
            labelContainer.setAttribute("width", radius * 2);
            labelContainer.setAttribute("height", labelPosition === "top" ? 60 : 40); // Adjusted label height
            labelContainer.innerHTML = `
                <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: center; justify-content: center; text-align: center; font-size: 20px; color: white;">
                    <span class="iconify" data-icon="${icon}" style="margin-right: 5px;"></span>
                    ${label}
                </div>
            `;
            group.appendChild(labelContainer);

            return group;
        };

        // Add gauges to SVG
        svg.appendChild(createGauge(positions.PV.x, positions.PV.y, `${this.solarData.P_PV || 0} W`, null, Math.min((this.solarData.P_PV || 0) / this.config.MaxPowerPV, 1), pvColor, "PV", this.config.icons.P_PV, "top"));
        svg.appendChild(createGauge(positions.Grid.x, positions.Grid.y, `${this.solarData.P_Grid || 0} W`, null, Math.min(Math.abs(this.solarData.P_Grid || 0) / this.config.MaxPower, 1), gridColor, "Grid", this.config.icons.P_Grid, "top"));
        svg.appendChild(createGauge(positions.Akku.x, positions.Akku.y, `${this.solarSOC || 0}%`, `${this.solarData.P_Akku || 0} W`, Math.min(this.solarSOC / 100, 1), akkuColor, "Akku", this.config.icons.P_Akku, "bottom"));
        svg.appendChild(createGauge(positions.House.x, positions.House.y, `${outerPower || 0} W`, null, Math.min(Math.abs(outerPower || 0) / this.config.MaxPower, 1), houseColor, "House", this.config.icons.P_Load, "bottom"));

        wrapper.appendChild(svg);
	
	// Add dynamic text message below the gauge
    	if (this.config.ShowText) {
        const textMessageDiv = document.createElement("div");
        textMessageDiv.className = "text-message2";

        const messageConfig = this.config.TextMessge || [];
        let selectedMessage = null;

	for (const message of messageConfig) {
	    if (
	        (message.about && this.solarData.P_Grid > parseInt(message.about)) ||
	        (message.less && this.solarData.P_Grid < parseInt(message.less))
	    ) {
	        // If no message is selected yet, or the new match is more specific
	        if (
	            !selectedMessage ||
	            (message.about && parseInt(message.about) > parseInt(selectedMessage.about || -Infinity)) ||
	            (message.less && parseInt(message.less) < parseInt(selectedMessage.less || Infinity))
	        ) {
	            selectedMessage = message;
	        }
	    }
	}

        if (selectedMessage) {
            textMessageDiv.innerHTML = `
                <span style="color: ${selectedMessage.color}; font-size: 18px;">
                    ${selectedMessage.Text}
                </span>
            `;
        } else {
            textMessageDiv.innerHTML = `
                <span style="color: #999; font-size: 16px;">
                    PV Anlage läuft...
                </span>
            `;
        }

        wrapper.appendChild(textMessageDiv);
    	}
	
        return wrapper;
    }
});