if (document.getElementById('testimonials_table') != undefined) {
    var table = $("#testimonials_table").DataTable({
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
        "ajax": {
            "url": baseUrl + "/api/getTestimonials",
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
            { data: "user", className: "text-center fs-6" },
            { data: "master", className: "text-center fs-6" },
            { data: "course" , className: "text-center fs-6"},
            { data: "rating" , className: "text-center fs-6"},
            { data: "approval" , className: "text-center fs-6"},
            // { data: "created_by", className: "text-center fs-6" },
            { data: "updated_by_name", className: "text-center fs-6" },
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
            $('[data-bs-toggle="tooltip"]').tooltip();
        }
    });
}


function approval_status(id,status){
    swal
      .fire({
        title: "",
        text: "Are You Sure ?",
        imageWidth: 48,
        imageHeight: 48,
        showCloseButton: true,
        showCancelButton: true,
        cancelButtonText: "Cancel",
        confirmButtonText: "Do, it !",
        cancelButtonColor: "#d33",
        confirmButtonColor: "#3085d6",
        width: 320,
        allowOutsideClick: false,
      })
      .then(function (result) {
        if (result.value) {
                var actionUrl = baseUrl + '/api/testimonials/' + id + '/approvalStatus/' + status;
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
                        //toastr.error(response.message);
                        fail_message(response.responseJSON.message);
                    }
                });
        }
      });
}

function delete_data(id) {
    swal
      .fire({
        //title: "Delete",
        icon: "warning",
        text: "Are You Sure ?",
        imageWidth: 48,
        imageHeight: 48,
        showCloseButton: true,
        showCancelButton: true,
        cancelButtonText: "Cancel",
        confirmButtonText: "Yes, Delete it!",
        cancelButtonColor: "#d33",
        confirmButtonColor: "#3085d6",
        width: 320,
        allowOutsideClick: false,
      })
      .then(function (result) {
        if (result.value) {
          var actionUrl = baseUrl + "/api/testimonials/" + JSON.stringify(id);
          var method = "DELETE";
          $.ajax({
            url: actionUrl,
            method: method,
            dataType: "json",
            beforeSend: function () {},
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
              toastr.error(response.responseJSON.message);
            },
          });
        }
      });
}

function view_data(id) {
    var actionUrl = baseUrl + "/api/testimonials/" + id;
    var method = "GET";
    $.ajax({
      url: actionUrl,
      method: method,
      dataType: "json",
      beforeSend: function () {},
      success: function (response) {
        toastr.remove();
        if (response.status) {
          $("#viewModal").modal("show");
          $('form#viewForm [name="name"]').val(response.data.users_name);
          $('form#viewForm [name="master"]').val(response.data.master_name);
          $('form#viewForm [name="course"]').val(response.data.courses_name);
          $('form#viewForm [name="comment"]').val();
          $('#ratingView').empty();
          $('#ratingView')
            .append(response.rating)
        } else {
          //toastr.error(response.message);
          fail_message(response.message);
        }
      },
      error: function (response) {
        toastr.remove();
        //toastr.error(response.message);
        fail_message(response.responseJSON.message);
      },
    });
  }

  $("#filter").click(function(){
    $("#testimonials_table").DataTable().ajax.reload();
  });

$("#filter_collapse").click(function(){
    $(".filter_card").toggleClass("hidden");
  });

$("#clear").click(function(){
    $('#status').val('').trigger('change')
    $('#master').val('').trigger('change')
    $('#rating').val('').trigger('change')
    $("#testimonials_table").DataTable().ajax.reload();
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

