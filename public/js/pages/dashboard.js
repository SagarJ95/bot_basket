
window.onload = function () {

    load_categorywise_purchase_graph();
    load_monthwise_purchase_graph(new Date().getFullYear(),"current_year_line_tab_graph");

    let lastYear = new Date().getFullYear() - 1;
    load_monthwise_purchase_graph(lastYear,"last_year_line_tab_graph");

    $("#kt_charts_widget_35_tab_1").click();

    $('#masterTable').DataTable({
        "paging": true,         // Enable pagination
        "searching": true,      // Enable search box
        "ordering": true,       // Enable sorting
        "info": true,           // Show info ("Showing X of Y entries")
        "lengthMenu": [5, 10, 25, 50], // Page length options
        "columnDefs": [
            { "orderable": false, "targets": [0, 2] } // Disable sorting on MASTER & BUYERS
        ]
    });

    earing_graph();
};

$("#kt_charts_widget_35_tab_1").click(function(){
    $("#kt_charts_widget_35_tab_1").toggleClass('active')
});

$("#kt_charts_widget_35_tab_2").click(function(){
    $("#kt_charts_widget_35_tab_2").toggleClass('active')
});



//const chartElement = document.getElementById("year_earning");

function earing_graph()
{
    const chartElement = document.getElementById("year_earning");

    if (chartElement) {
        // Destroy any existing chart before re-creating it


        var options = {
            series: [$("#year1").attr('amount'), $("#year2").attr('amount'), $("#year3").attr('amount')], // Initial data
            chart: {
                type: 'donut',
                height: 150
            },
            labels: [$("#year1").attr('year'), $("#year2").attr('year'), $("#year3").attr('year')], // Labels for data
            colors: ['#17c653', '#1b84ff', '#f8285a'], // Custom colors
            legend: {
                show: false
            }
        };

        var chart = new ApexCharts(chartElement, options);
        chart.render();

        // Store the chart instance globally to avoid multiple renders
        window.myDonutChart = chart;
    }
}

function load_categorywise_purchase_graph() {
    $.ajax({
        url: baseUrl + "/api/categoryWiseCoursePurchaseCount",
        method: "POST",
        success: function (response) {
            if (response.status && response.data.length > 0) {
                let data = response.data;

                let categories = data.map(item => item.cat_name);
                let courseCounts = data.map(item => Number(item.course_count));  // Convert to number
                let purchaseCounts = data.map(item => Number(item.buyers_count)); // Convert to number

                console.log("Categories:", categories);
                console.log("Course Counts:", courseCounts);
                console.log("Purchase Counts:", purchaseCounts);

                // Destroy existing chart if present
                if (window.categoryChart) {
                    window.categoryChart.destroy();
                }

                let options = {
                    chart: {
                        type: "bar",
                        height: 400
                    },
                    series: [
                        {
                            name: "Courses",
                            data: courseCounts
                        },
                        {
                            name: "Purchases",
                            data: purchaseCounts
                        }
                    ],
                    xaxis: {
                        categories: categories
                    }
                };

                let chart = new ApexCharts(document.querySelector("#chart_category"), options);
                chart.render();

                // Store chart instance globally to avoid duplicate charts
                window.categoryChart = chart;
            } else {
                console.log("No data available");
            }
        },
        error: function (error) {
            console.log("Error fetching data:", error);
        }
    });
}

function load_monthwise_purchase_graph(year, graph) {
    $.ajax({
        url: baseUrl + "/api/monthwiseCoursesPurchaseCount",
        method: "POST",
        data: { year: year },
        success: function (response) {
            if (response.status) {
                let months = response.data.map(item => item.month);
                let purchases = response.data.map(item => Number(item.buyers_count));

                console.log("Months:", months);
                console.log("Purchases:", purchases);

                // Destroy existing chart if present
                // if (window.monthlyChart) {
                //     window.monthlyChart.destroy();
                // }

                let options = {
                    chart: {
                        type: "line",
                        height: 400
                    },
                    series: [{
                        name: "Purchases",
                        data: purchases
                    }],
                    xaxis: {
                        categories: months,
                        labels: {
                            formatter: function (val) {
                                return val; // Show only month (e.g., 01, 02, 03)
                            }
                        }
                    },
                    yaxis: {
                        min: 0, // Ensure Y-axis starts at 0
                        forceNiceScale: true // Ensure graph displays even for low values
                    },
                    stroke: {
                        curve: "smooth" // Makes the graph more readable
                    },
                    markers: {
                        size: 5, // Add markers for clarity
                        colors: ["#FF4560"]
                    }
                };

                let chart = new ApexCharts(document.querySelector("#" + graph), options);
                chart.render();

                // Store chart instance globally
                window.monthlyChart = chart;
            } else {
                console.log("No data available");
            }
        },
        error: function (error) {
            console.log("Error fetching data:", error);
        }
    });
}



