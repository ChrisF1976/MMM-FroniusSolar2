const NodeHelper = require("node_helper");
const fetch = require("node-fetch");

module.exports = NodeHelper.create({
    start: function () {
    },

    socketNotificationReceived: function (notification) {
        if (notification === "GET_FRONIUS_DATA") {
            this.getFroniusData();
        }
    },

    getFroniusData: function () {
        const url = "http://192.168.178.134/solar_api/v1/GetPowerFlowRealtimeData.fcgi";

        fetch(url)
            .then(response => response.json())
            .then(data => {

                const siteData = data.Body.Data.Site;
                const inverterData = data.Body.Data.Inverters ? data.Body.Data.Inverters["1"] : {};

                const result = {
                    P_Akku: siteData.P_Akku || 0,
                    P_Grid: siteData.P_Grid || 0,
                    P_Load: siteData.P_Load || 0,
                    P_PV: siteData.P_PV || 0,
                    Inverters: { "1": { SOC: inverterData.SOC || 0 } }
                };

                this.sendSocketNotification("FRONIUS_DATA", result);
            })
            .catch(error => {
                console.error("[MMM-FroniusSolar] Error fetching data:", error);
            });
    }
});
