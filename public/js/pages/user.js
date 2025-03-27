var table = $("#user_table").DataTable({
  searching: true,
  ordering: false,
  aLengthMenu: [
    [10, 15, 25, 50, 100, -1],
    [10, 15, 25, 50, 100, "All"],
  ],
  language: { lengthMenu: "Show _MENU_" },
  dom:
    "<'row mb-2'" +
    "<'col-sm-6 d-flex align-items-center justify-content-start dt-toolbar'l>" +
    "<'col-sm-6 d-flex align-items-center justify-content-end dt-toolbar'f>" +
    ">" +
    "<'table-responsive'tr>" +
    "<'row'" +
    "<'col-sm-12 col-md-5 d-flex align-items-center justify-content-center justify-content-md-start'i>" +
    "<'col-sm-12 col-md-7 d-flex align-items-center justify-content-center justify-content-md-end'p>" +
    ">",
  processing: true,
  serverSide: true,
  serverMethod: "POST",
  ajax: {
    url: baseUrl + "/api/getUsers",
    type: "POST",
    headers: {
      Accept: "application/json",
    },
    data: function (d) {
            let formData = $("#filterForm").serializeArray().reduce((obj, item) => {
                obj[item.name] = item.value;
                return obj;
            }, {});

            return Object.assign(d, formData); // Merge filter values into DataTables request
        },
    dataSrc: function (json) {
      return json.data;
    },
  },
  columns: [
    { data: "name", className: "text-center fs-6" },
    { data: "address", className: "text-center fs-6" },
    { data: "roles", className: "text-center fs-6" },
    { data: "status", className: "text-center fs-6" ,visible:isActionVisible },
    //{ data: "created_by", className: "text-center fs-6" },
    { data: "updated_by", className: "text-center fs-6" },
    {
      data: "action",
      orderable: false,
      searchable: false,
      className: "text-end",
      visible:isActionVisible
    },
  ],
});

table.on("draw", function () {
  if ($('[data-bs-toggle="tooltip"]') !== undefined) {
    //$('[data-bs-toggle="tooltip"]').tooltip(); // Reinitialize tooltips
  }
});

$("form#addEditForm").on("submit", function (e) {
  e.preventDefault();

  var form = $(this);
  var formArray = form.serializeArray(); // Get form data as array
  var formData = {}; // Empty object to hold JSON data

  // Convert form data array to JSON object
  $.each(formArray, function (i, field) {
    formData[field.name] = field.value;
  });

  var id = $("#user_id").val();

  var actionUrl = id == "" ? "/api/users" : "/api/users/" + id;
  var method = id == "" ? "POST" : "PATCH";

  $.ajax({
    url: baseUrl + actionUrl,
    method: method,
    data: JSON.stringify(formData), // Send form data as JSON
    contentType: "application/json", // Set the content type to JSON
    dataType: "json",
    headers: {
      Accept: "application/json",
    },
    beforeSend: function () {
      form.find("span.error").text("");
      form.find('button[type="submit"]').prop("disabled", true);
    },
    success: function (response) {
      if (response.status) {
        //toastr.success(response.message);
        success_message(response.message);
        table.ajax.reload();
        $("#addEditModal").modal("hide");
        resetForm();
      } else {
        //toastr.error(response.message);
        fail_message(response.message);
      }
      form.find('button[type="submit"]').prop("disabled", false);
    },
    error: function (response) {
      form.find('button[type="submit"]').prop('disabled', false);
            toastr.remove();
            if (response.responseJSON.errors) {
                Object.entries(response.responseJSON.errors).forEach(([fieldName, errorMsg]) => {
                    const field = $(`[name="${fieldName}"]`);
                    if (field.length) {
                        form.find('span.' + fieldName + '-error').text(errorMsg);
                    }
                });
            }
    },
  });
});

function edit_data(id) {
  var actionUrl = baseUrl + "/api/users/" + id;
  var method = "GET";
  $.ajax({
    url: actionUrl,
    method: method,
    dataType: "json",
    beforeSend: function () {},
    success: function (response) {
      toastr.remove();
      if (response.status) {
        $("#addEditModal").modal("show");
        $("form#addEditForm .modal-title").text("Edit user");
        $('form#addEditForm [name="user_id"]').val(response.data.id);
        $('form#addEditForm [name="name"]').val(response.data.name);
        $('form#addEditForm [name="email"]').val(response.data.email);
        $('form#addEditForm [name="password"]').val("");
        $('form#addEditForm [name="role"]')
          .val(response.data.role)
          .trigger("change");
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
        var actionUrl = baseUrl + "/api/users/" + id;
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
            //toastr.error(response.message);
            fail_message(response.responseJSON.message);
          },
        });
      }
    });
}

function change_status(id, status) {
  var formData = {};
  formData["status"] = status;
  var actionUrl = baseUrl + "/api/users_change_status/" + id;
  var method = "PATCH";
  $.ajax({
    url: actionUrl,
    method: method,
    data: JSON.stringify(formData), // Send form data as JSON
    contentType: "application/json", // Set the content type to JSON
    dataType: "json",
    headers: {
      Accept: "application/json",
    },
    beforeSend: function () {},
    success: function (response) {
      toastr.remove();
      if (response.status) {
        toastr.success(response.message);
        table.ajax.reload();
        resetForm();
      } else {
        toastr.error(response.message);
      }
    },
    error: function (response) {
      toastr.remove();
      toastr.error(response.responseJSON.message);
    },
  });
}

$(".btn-close,#btnclose").on("click", function () {
  console.log("in");
  resetForm();
});

function resetForm() {
  $("form#addEditForm .modal-title").text("Add user");
  $("#user_id").val("");
  $("#name").val("");
  $("#email").val("");
  $("#role").val("").trigger("change");
  $(".error").text("");
  return false;
}

$("#filter").click(function(){
  $("#user_table").DataTable().ajax.reload();
});

$("#filter_collapse").click(function(){
  $(".filter_card").toggleClass("hidden");
});

$("#clear").click(function(){
  $('#role').val('').trigger('change')
  $('#status').val('').trigger('change')
  $("#user_table").DataTable().ajax.reload();
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
