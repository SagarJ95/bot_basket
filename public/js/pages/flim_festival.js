
if (document.getElementById('flim_festival_table') != undefined) {
var table = $("#flim_festival_table").DataTable({
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
      url: baseUrl + "/api/getflim_festival",
      type: "POST",
      headers: {
        Accept: "application/json",
      },
      dataSrc: function (json) {
        return json.data;
      },
    },
    columns: [
      { data: "title", className: "text-center fs-6" },
      //{ data: "created_by", className: "text-center fs-6" },
      { data: "flim_festival_date", className: "text-center fs-6" },
      { data: "short_desc", className: "text-center fs-6" },
      { data: "status", className: "text-center fs-6",visible:isActionVisible
       },
      { data: "updated_by", className: "text-center fs-6" },
      {
        data: "action",
        orderable: false,
        searchable: false,
        className: "text-center",
       visible:isActionVisible
      },
    ],
  });

  table.on("draw", function () {
    if ($('[data-bs-toggle="tooltip"]') !== undefined) {
      //$('[data-bs-toggle="tooltip"]').tooltip(); // Reinitialize tooltips
    }
  });
}

if (document.getElementById('view_flim_festival_table') != undefined) {
  var table = $("#view_flim_festival_table").DataTable({
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
        url: baseUrl + "/api/get_view_customer_flim_festival",
        type: "POST",
        headers: {
          Accept: "application/json",
        },
        dataSrc: function (json) {
          return json.data;
        },
      },
      columns: [
        { data: "flim_festival_title", className: "text-center fs-6" },
        //{ data: "created_by", className: "text-center fs-6" },
        { data: "name", className: "text-center fs-6" },
        { data: "phone_no", className: "text-center fs-6" },
        { data: "email", className: "text-center fs-6" },
        // { data: "status", className: "text-center fs-6",visible:isActionVisible
        //  },
        { data: "updated_by", className: "text-center fs-6" },
        // {
        //   data: "action",
        //   orderable: false,
        //   searchable: false,
        //   className: "text-center",
        //  visible:isActionVisible
        // },
      ],
    });

    table.on("draw", function () {
      if ($('[data-bs-toggle="tooltip"]') !== undefined) {
        //$('[data-bs-toggle="tooltip"]').tooltip(); // Reinitialize tooltips
      }
    });
  }

if (document.querySelector('#long_desc') && !document.querySelector('#long_desc').classList.contains('ck-editor-loaded')) {
    ClassicEditor.create(document.querySelector('#long_desc'))
        .then(editor => {
            console.log(editor);
            document.querySelector('#long_desc').classList.add('ck-editor-loaded'); // Prevent re-initialization
        })
        .catch(error => {
            console.error(error);
        });
}

$("#flim_festival_date").daterangepicker({locale: {
    format: "DD-MM-YYYY" // Ensures the date format is correct
}});

$("form#addEditForm").on("submit", function (e) {

    e.preventDefault();

    var form = $(this);
    var formArray = form.serializeArray(); // Get form data as array
    var formData = {}; // Empty object to hold JSON data

    // Convert form data array to JSON object
    $.each(formArray, function (i, field) {
      formData[field.name] = field.value;
    });

    var id = $("#flim_festival_id").val() || '';

    var actionUrl = id == "" ? "/api/flim_festival" : "/api/flim_festival/" + id;
    var method = id == ""   ? "POST" : "PATCH";

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
        form.find("span.error-text").text("");
        form.find('button[type="submit"]').prop("disabled", true);
      },
      success: function (response) {
        if (response.status) {
          //toastr.success(response.message);
          success_message(response.message);
          setTimeout(() => {
            location.href = '/admin/film-festival';
        }, 1200);
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
var actionUrl = baseUrl + "/api/roles/" + id;
var method = "GET";
$.ajax({
    url: actionUrl,
    method: method,
    dataType: "json",
    beforeSend: function () {},
    success: function (response) {
    toastr.remove();
    if (response.status) {
        $("form#addEditForm .modal-title").text("Edit");
        $('form#addEditForm [name="flim_festival_id"]').val(response.data.id);
        $('form#addEditForm [name="title"]').val();
        $('form#addEditForm [name="flim_festival_date"]').val();
        $('form#addEditForm [name="short_desc"]').val();
        $('form#addEditForm [name="long_desc"]').val();
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
        var actionUrl = baseUrl + "/api/flim_festival/" + id;
        var method = "DELETE";
        $.ajax({
        url: actionUrl,
        method: method,
        dataType: "json",
        beforeSend: function () {},
        success: function (response) {
            toastr.remove();
            if (response.status) {
            // toastr.success(response.message);
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

function change_status(id, status) {
  var formData = {};
  formData["status"] = status;
  var actionUrl = baseUrl + '/api/flim_festival/' + id + '/changeStatus/' + status;
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
        //resetForm();
      } else {
        toastr.error(response.message);
      }
    },
    error: function (response) {
      toastr.remove();
      toastr.error(response.message);
    },
  });
}