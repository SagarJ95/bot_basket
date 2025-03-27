var table = $("#customers_table").DataTable({
    "searching": true,
    "ordering": false,
    "aLengthMenu": [
        [10, 15, 25, 50, 100, -1],
        [10, 15, 25, 50, 100, "All"]
    ],
    "language": { "lengthMenu": "Show _MENU_" },
    "dom": "<'row mb-2'" +
        "<'col-sm-6 d-flex align-items-center justify-content-start dt-toolbar'l>" +
        "<'col-sm-6 d-flex align-items-center justify-content-end dt-toolbar'f>" +
        ">" +
        "<'table-responsive'tr>" +
        "<'row'" +
        "<'col-sm-12 col-md-5 d-flex align-items-center justify-content-center justify-content-md-start'i>" +
        "<'col-sm-12 col-md-7 d-flex align-items-center justify-content-center justify-content-md-end'p>" +
        ">",
    "processing": true,
    "serverSide": true,
    "serverMethod": "POST",
    "ajax": {
        "url": baseUrl + "/api/getCustomers",
        "type": "POST",
        "headers": {
            "Accept": "application/json"
        },
        "data": function (d) {
            let formData = $("#filterForm").serializeArray().reduce((obj, item) => {
                obj[item.name] = item.value;
                return obj;
            }, {});

            return Object.assign(d, formData); // Merge filter values into DataTables request
        },
        "dataSrc": function (json) {
            return json.data;
        }
    },
    "columns": [
        { data: "first_name", className: "text-center fs-6" },
        { data: "last_name", className: "text-center fs-6" },
        { data: "email", className: "text-center fs-6" },
        { data: "phone_no", className: "text-center fs-6" },
        { data: "createdAt", className: "text-center fs-6" },
        { data: "status", className: "text-center fs-6",visible:isActionVisible },
        {
            data: "action",
            orderable: false,
            searchable: false,
            className: "text-end",
            visible:isActionVisible
        }
    ]
});

table.on('draw', function () {
    if ($('[data-bs-toggle="tooltip"]') !== undefined) {
        $('[data-bs-toggle="tooltip"]').tooltip(); // Reinitialize tooltips
    }
});

function change_status(id, status) {
    var actionUrl = baseUrl + '/api/customer/' + id + '/changeStatus/' + status;
    var method = "PATCH";
    $.ajax({
        url: actionUrl,
        method: method,
        data: { status: status },
        dataType: "json",
        beforeSend: function () { },
        success: function (response) {
            toastr.remove();
            if (response.status) {
                //toastr.success(response.message);
                success_message(response.message);
                table.ajax.reload();
            } else {
                //toastr.error(response.message);
                fail_message(response.message);
            }
        },
        error: function (response) {
            toastr.remove();
            fail_message(response.responseJSON.message);
        }
    });
}

function delete_data(id) {
    swal.fire({
        //title: 'Remove',
        icon: "warning",
        text: 'Are You Sure ?',
        imageWidth: 48,
        imageHeight: 48,
        showCloseButton: true,
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        confirmButtonText: 'Yes, Remove it!',
        cancelButtonColor: '#d33',
        confirmButtonColor: '#3085d6',
        width: 320,
        allowOutsideClick: false,
    }).then(function (result) {
        if (result.value) {
            var actionUrl = baseUrl + '/api/customer/' + id;
            var method = "DELETE";
            $.ajax({
                url: actionUrl,
                method: method,
                dataType: "json",
                beforeSend: function () { },
                success: function (response) {
                    toastr.remove();
                    if (response.status) {
                        toastr.success(response.message);
                        table.ajax.reload();
                    } else {
                        toastr.error(response.message);
                    }
                },
                error: function (response) {
                    toastr.remove();
                    toastr.error(response.responseJSON.message);
                }
            });
        }
    });
}

/********************************* Customer view Info called *************************************/

$("#filter").click(function(){
    $("#customers_table").DataTable().ajax.reload();
  });

$("#filter_collapse").click(function(){
    $(".filter_card").toggleClass("hidden");
  });

$("#clear").click(function(){
    $('#status').val('').trigger('change')
    $("#customers_table").DataTable().ajax.reload();
})

var start = moment().startOf("month").format("DD-MM-YYYY")
var end = moment().endOf("month").format("DD-MM-YYYY")

function cb(start, end) {
    $("#range_date").html(start.format("DD-MM-YYYY") + " - " + end.format("DD-MM-YYYY"));
}

$("#range_date").daterangepicker({
    locale: {
                format: "DD-MM-YYYY"
            },
    startDate: start,
    endDate: end,
    ranges: {
    "Today": [moment(), moment()],
    "Yesterday": [moment().subtract(1, "days"), moment().subtract(1, "days")],
    "Last 7 Days": [moment().subtract(6, "days"), moment()],
    "Last 30 Days": [moment().subtract(29, "days"), moment()],
    "This Month": [moment().startOf("month"), moment().endOf("month")],
    "Last Month": [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")]
    }
}, cb);

cb(start, end);
