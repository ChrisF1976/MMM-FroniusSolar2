const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
    config: null, // Initially, no config is set

    start: function () {},

    socketNotificationReceived: function (notification, payload) {
        if (notification === "SET_CONFIG") {
            this.config = payload;
            this.startFetchingData();
        } else if (notification === "GET_FRONIUS_DATA") {
            if (!this.config) return;
            this.getFroniusData();
        }
    },

    startFetchingData: function () {
        if (this.config && this.config.InverterIP) {
            this.fetchInterval = setInterval(() => {
                this.getFroniusData();
            }, 60000); // Fetch data every 60 seconds
        }
    },

    getFroniusData: function () {
        if (!this.config || !this.config.InverterIP) return;

        const url = `http://${this.config.InverterIP}/solar_api/v1/GetPowerFlowRealtimeData.fcgi`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error!`);
                }
                return response.json();
            })
            .then(data => {
                const siteData = data.Body.Data.Site;
                const inverterData = data.Body.Data.Inverters ? data.Body.Data.Inverters["1"] : {};

                const result = {
                    P_Akku: siteData.P_Akku || 0,
                    P_Grid: siteData.P_Grid || 0,
                    P_Load: siteData.P_Load || 0,
                    P_PV: siteData.P_PV || 0,
                    Inverters: { "1": { SOC: inverterData.SOC || 0 } },
                };

                this.sendSocketNotification("FRONIUS_DATA", result);
            })
            .catch(() => {});
    },
});
