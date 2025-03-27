var table = $("#category_table").DataTable({
  searching: true,
  ordering: false,
  "rowReorder": {
          selector: 'td:not(.no-reorder)',  // Makes the entire row draggable
            update: false    // Prevents auto-updating; we'll handle it manually
        },
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
    url: baseUrl + "/api/getCategories",
    type: "POST",
    headers: {
      Accept: "application/json",
    },
    dataSrc: function (json) {
      return json.data;
    },
  },
  columns: [
    { data:"id", className: "text-center fs-6", visible:false},
    { data:"ordering", className: "text-center fs-6"},
    { data: "icon", className: "text-center fs-6 no-reorder" },
    { data: "green_icon", className: "text-center fs-6 no-reorder" },
    { data: "cat_name", className: "text-center fs-6" },
    //{ data: "created_by_name", className: "text-center fs-6" },
    { data: "updated_by_name", className: "text-center fs-6" },
    {
      data: "action",
      orderable: false,
      searchable: false,
      className: "text-end no-reorder",
      visible:isActionVisible
    },
  ],
});

table.on('row-reorder', function (e, diff, edit) {
  if (diff.length) {
    let reorderedData = [];

    // Loop through the reordered rows (from 'diff')
    for (let i = 0; i < diff.length; i++) {
      let rowData = table.row(diff[i].node).data();
      reorderedData.push({
          id: rowData.id,  // Use the unique ID for each row (assuming 'ordering' is the ID)
          new_position: diff[i].newPosition + 1  // The new position starts from 1
      });
  }

  // Loop through all rows in the table to capture rows that were not reordered
    table.rows().every(function (rowIdx) {
        let rowData = this.data();
        let isReordered = diff.some(d => d.node === this.node());
        if (!isReordered) {
            reorderedData.push({
                id: rowData.id,
                new_position: rowIdx + 1
            });
        }
    });

    $.ajax({
        url: baseUrl + "/api/updateCategoryOrder",
        type: "PATCH",
        headers: { "Accept": "application/json" },
        data: JSON.stringify(reorderedData),
        contentType: "application/json",
        success: function(response) {
         //   console.log('Order updated successfully:', response);
            table.ajax.reload();  // Reload table if needed
            resetForm();
        },
        error: function(error) {
            console.error('Error updating order:', error);
        }
    });
}
});

table.on("draw", function () {
  if ($('[data-bs-toggle="tooltip"]') !== undefined) {
    $('[data-bs-toggle="tooltip"]').tooltip(); // Reinitialize tooltips
  }
});

var isImageValid = true;
var isGreenImageValid = true;

$.validator.addMethod("imageSize", function (value, element, param) {
    if (element.files.length === 0) {
        return true; // No file uploaded, allow submission
    }

    var file = element.files[0];
    var fileType = file.name.split('.').pop().toLowerCase(); // Get file extension

    var allowedFormats = ["svg"];

    if (!allowedFormats.includes(fileType)) {
        $("#mediaPreview").attr("src", 'https://placehold.co/24x24').show();
        isImageValid = false;
        return false; // Invalid file type
    }

    var img = new Image();
    var objectURL = URL.createObjectURL(file);
    img.src = objectURL;

    img.onload = function () {
        if (img.width === param[0] && img.height === param[1]) {
            $("#mediaPreview").attr("src", objectURL).show(); // Show preview
            isImageValid = true;
        } else {
            $("#mediaPreview").hide(); // Hide preview if invalid
            $("#mediaPreview").attr("src", 'https://placehold.co/24x24').show();
            isImageValid = false;
        }

        $(element).valid(); // Trigger revalidation
    };

    return isImageValid;
}, "Icon must be a SVG image with a resolution of 24x24 pixels.");


$.validator.addMethod("greenimageSize", function (value, element, param) {

  if (element.files.length === 0) {
      return true; // No file uploaded, allow submission
  }

  var file = element.files[0];
  var fileType = file.name.split('.').pop().toLowerCase(); // Get file extension

  var allowedFormats = ["svg"];

  if (!allowedFormats.includes(fileType)) {
      $("#mediaPreviewgreenicon").attr("src", 'https://placehold.co/24x24').show();
      isGreenImageValid = false;
      return false; // Invalid file type
  }

  var img = new Image();
  var objectURL = URL.createObjectURL(file);
  img.src = objectURL;

  img.onload = function () {
      if (img.width === param[0] && img.height === param[1]) {
          $("#mediaPreviewgreenicon").attr("src", objectURL).show(); // Show preview
          isGreenImageValid = true;
      } else {
          $("#mediaPreviewgreenicon").hide(); // Hide preview if invalid
          $("#mediaPreviewgreenicon").attr("src", 'https://placehold.co/24x24').show();
          isGreenImageValid = false;
      }

      $(element).valid(); // Trigger revalidation
  };

  return isGreenImageValid;
}, "Green Icon must be a SVG image with a resolution of 24x24 pixels.");

// Initialize jQuery Validation
var validator = $("#addEditForm").validate({
    rules: {
        icon: {
            required: function () {
                return $("#category_id").val() === ""; // Required only in "add" mode
            },
            imageSize: [24, 24] // Custom validation rule (handles both size & format)
        },
        green_icon: {
          required: function () {
              return $("#category_id").val() === ""; // Required only in "add" mode
          },
          greenimageSize: [24, 24] // Custom validation rule (handles both size & format)
      }
    },
    messages: {
      icon: {
            required: "Please upload a icon."
        },
        green_icon: {
          required: "Please upload a Green icon."
      }
    },
    errorPlacement: function (error, element) {
        error.insertAfter(element); // Append error below file input
    },
    submitHandler: function (form) {
        if (!isImageValid) {
            validator.element("#icon"); //
             validator.element("#green_icon"); // Ensure error message shows
            return false; // Prevent form submission
        }

        // Call the submitForm function
        submitForm(form);
    }
});

$("#icon").on("change", function () {
    validator.element(this); // Revalidate the file input
});

$("#green_icon").on("change", function () {
  validator.element(this); // Revalidate the file input
});

function submitForm(form) {
  var formData = new FormData(form);
  var id = $("#cat_id").val();
  var actionUrl = id == "" ? "/api/category" : "/api/category/" + id;
  var method = id == "" ? "POST" : "PATCH";

  $.ajax({
    url: baseUrl + actionUrl,
    method: method,
    data: formData, // Send form data as JSON
    //contentType: "application/json", // Set the content type to JSON
    processData: false,
    contentType: false,
    headers: {
      Accept: "application/json",
    },
    beforeSend: function () {
      $(".error-message").remove();
      $("#form_save_button").attr('disabled', true);
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
      $("#form_save_button").attr('disabled', false);
    },
    error: function (response) {
        console.log(response)
        $("#form_save_button").attr('disabled', false);
        $(".error-message").remove();
        if (response.responseJSON && response.responseJSON.errors && response.responseJSON.errors.errors) {
            response.responseJSON.errors.errors.forEach(function (error) {
            // Select the input field based on the `path` in the error
            const field = $(`[name="${error.path}"]`);
            if (field.length) {
                // Append error message next to the field
                field.after(`<div class="error-message text-danger">${error.msg}</div>`);
            }
            });
        }
    },
  });
}

$("form#addEditForm").on("submit", function (e) {
  e.preventDefault();

  // Trigger jQuery Validation
  if (!validator.form()) {
      return false; // Prevent form submission if validation fails
  }
});


function edit_data(id) {
  var actionUrl = baseUrl + "/api/category/" + JSON.stringify(id);
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
        $('form#addEditForm [name="cat_id"]').val(response.data.id);
        $('form#addEditForm [name="cat_name"]').val(response.data.cat_name);
        $("#mediaPreview").attr('src',response.data.icon)
        $("#mediaPreviewgreenicon").attr('src',response.data.green_icon)
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
        var actionUrl = baseUrl + "/api/category/" + JSON.stringify(id);
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

function resetForm() {
  setTimeout(()=>{
    $("#addEditForm")[0].reset();
    $('#cat_id').val('');
    $('#cat_name').val('');
    $("#mediaPreview").attr('src', 'https://placehold.co/24x24');
    $("#mediaPreviewgreenicon").attr('src', 'https://placehold.co/24x24');
    $(".error").text("");
  },2000)

  //return false;
}
