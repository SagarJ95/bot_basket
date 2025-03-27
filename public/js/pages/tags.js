var table = $("#tag_table").DataTable({
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
      url: baseUrl + "/api/getTags",
      type: "POST",
      headers: {
        Accept: "application/json",
      },
      dataSrc: function (json) {
        return json.data;
      },
    },
    columns: [
      { data: "name", className: "text-center fs-6" },

      //{ data: "created_by", className: "text-center fs-6" },
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
      $('[data-bs-toggle="tooltip"]').tooltip(); // Reinitialize tooltips
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

    var id = $("#tag_id").val();

    var actionUrl = id == "" ? "/api/tag" : "/api/tag/" + id;
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
        form.find("span.error-text").text("");
        form.find('button[type="submit"]').prop("disabled", true);
      },
      success: function (response) {
        if (response.status) {
          //toastr.success(response.message);
          success_message(response.message);
          table.ajax.reload();
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
    var actionUrl = baseUrl + "/api/tag/" + JSON.stringify(id);
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
          $('form#addEditForm [name="tag_id"]').val(response.data.id);
          $('form#addEditForm [name="name"]').val(response.data.name);
        } else {
          //toastr.error(response.message);
          fail_message(response.message);
        }
      },
      error: function (response) {
        toastr.remove();
       // toastr.error(response.message);
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
          var actionUrl = baseUrl + "/api/tag/" + JSON.stringify(id);
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

  function resetForm() {
    $("#tag_id").val("");
    $("#name").val("");
    $(".error").text("");
    return false;
  }
