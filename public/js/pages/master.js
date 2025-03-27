var input = document.getElementById('awards');
var tagify1 = new Tagify(input);
tagify.on('change', function() {
    var tagData = tagify.value; // This gives an array of tag objects
    var commaSeparatedValues = tagData.map(tag => tag.value).join(', ');

    console.log(commaSeparatedValues); // Example Output: "sdsd, bhuis"
});

var input1 = document.getElementById('tags');
var tagify1 = new Tagify(input1);
tagify1.on('change', function() {
    var tagData = tagify1.value; // This gives an array of tag objects
    var commaSeparatedValues = tagData.map(tag => tag.value).join(', ');

    console.log(commaSeparatedValues); // Example Output: "sdsd, bhuis"
});

var table = $("#masters_table").DataTable({
    "searching": true,
    "ordering": false,
    "rowReorder": {
          selector: 'td:not(.no-reorder)',  // Makes the entire row draggable
            update: false    // Prevents auto-updating; we'll handle it manually
        },
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
        "url": baseUrl + "/api/getMasters",
        "type": "POST",
        "headers": {
            "Accept": "application/json"
        },
        "dataSrc": function (json) {
            return json.data;
        }
    },
    "columns": [
        { data:"id", className: "text-center fs-6", visible:false},
        { data:"ordering_id", className: "text-center fs-6"},
        { data: "photo", className: "text-center fs-6" },
        { data: "master_name", className: "text-center fs-6" },
        { data: "profession", className: "text-center fs-6" },
        //{ data: "created_by", className: "text-center fs-6" },
        { data: "updated_by", className: "text-center fs-6" },
        { data: "status", className: "text-end fs-6 no-reorder",visible:isActionVisible },
        { data: "trending_flag", className: "text-end fs-6 no-reorder",visible:isActionVisible },
        {
            data: "action",
            orderable: false,
            searchable: false,
            className: "text-end no-reorder",
            visible:isActionVisible
        }
    ]
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
          url: baseUrl + "/api/updateMasterOrder",
          type: "PATCH",
          headers: { "Accept": "application/json" },
          data: JSON.stringify(reorderedData),
          contentType: "application/json",
          success: function(response) {
              table.ajax.reload();  // Reload table if needed
          },
          error: function(error) {
              console.error('Error updating order:', error);
          }
      });
  }
});

table.on('draw', function () {
});

var isImageValid = true;
$.validator.addMethod("imageSize", function (value, element, param) {
    if (element.files.length === 0) {
        return true; // No file uploaded, allow submission
    }

    var file = element.files[0];
    var fileType = file.name.split('.').pop().toLowerCase(); // Get file extension

    // Allowed formats
    var allowedFormats = ["jpg", "jpeg", "png", "webp"];

    if (!allowedFormats.includes(fileType)) {
        $("#mediaPreview").attr("src", 'https://placehold.co/250x350').show();
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
            $("#mediaPreview").attr("src", 'https://placehold.co/250x350').show();
            isImageValid = false;
        }

        // Manually trigger validation after image loads
        $(element).valid();
    };

    return isImageValid; // Return the global flag for validation
}, "Photo must be an image with a resolution of 250x350 pixels.");


// Initialize jQuery Validation
var validator = $("#addEditForm").validate({
    rules: {
        photo: {
            required: function () {
                return $("#master_id").val() === ""; // Required only in "add" mode
            },
            imageSize: [250, 350] // Custom validation rule
        }
    },
    messages: {
        photo: {
            required: "Please upload a photo."
        }
    },
    errorPlacement: function (error, element) {
        error.insertAfter(element); // Append error below file input

    },
    submitHandler: function (form) {
        if (!isImageValid) {
            validator.element("#photo"); // Ensure error message shows
            return false;
        }
        submitForm(); // Submit via AJAX if validation passes
    }
});

// Trigger validation when the file input changes
$("#photo").on("change", function () {
    validator.element(this);
});


function submitForm()
{
    //e.preventDefault();

    var form = $("#addEditForm");
    var formData = new FormData(form[0]);

    const id = $("[name='master_id']").val();

    var actionUrl = id ? '/api/master/' + id : '/api/master';
    var method = id ? "PATCH" : "POST";

    $.ajax({
        url: baseUrl + actionUrl,
        method: method,
        data: formData,
        contentType: false,
        processData: false,
        headers: {
            Accept: 'application/json',
        },
        beforeSend: function () {
            form.find('span.error-text').text('');
            form.find('button[type="submit"]').prop('disabled', true);
        },
        success: function (response) {
            toastr.remove();
            if (response.status) {
                //toastr.success(response.message);
                success_message(response.message);
                $("#addEditModal").modal('hide');
                table.ajax.reload();
            } else {
               // toastr.error(response.message);
               fail_message(response.message);
            }
            form.find('button[type="submit"]').prop('disabled', false);
        },
        error: function (response) {

            form.find('button[type="submit"]').prop('disabled', false);
            toastr.remove();
            //console.log(response)
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
        }
    });
}

// $("form#addEditForm").on("submit", function (e) {
//     e.preventDefault();

//     var form = $(this);
//     var formData = new FormData(form[0]);

//     const id = $("[name='master_id']").val();

//     var actionUrl = id ? '/api/master/' + id : '/api/master';
//     var method = id ? "PATCH" : "POST";

//     $.ajax({
//         url: baseUrl + actionUrl,
//         method: method,
//         data: formData,
//         contentType: false,
//         processData: false,
//         headers: {
//             Accept: 'application/json',
//         },
//         beforeSend: function () {
//             form.find('span.error-text').text('');
//             form.find('button[type="submit"]').prop('disabled', true);
//         },
//         success: function (response) {
//             toastr.remove();
//             if (response.status) {
//                 //toastr.success(response.message);
//                 success_message(response.message);
//                 $("#addEditModal").modal('hide');
//                 table.ajax.reload();
//             } else {
//                // toastr.error(response.message);
//                fail_message(response.message);
//             }
//             form.find('button[type="submit"]').prop('disabled', false);
//         },
//         error: function (response) {

//             form.find('button[type="submit"]').prop('disabled', false);
//             toastr.remove();
//             //console.log(response)
//             $(".error-message").remove();

//             if (response.responseJSON && response.responseJSON.errors && response.responseJSON.errors.errors) {
//                 response.responseJSON.errors.errors.forEach(function (error) {
//                 // Select the input field based on the `path` in the error
//                 const field = $(`[name="${error.path}"]`);
//                 if (field.length) {
//                     // Append error message next to the field
//                     field.after(`<div class="error-message text-danger">${error.msg}</div>`);
//                 }
//                 });
//             }
//         }
//     });
// });

function edit_data(id) {
    var actionUrl = baseUrl + '/api/master/' + id;
    var method = "GET";
    $.ajax({
        url: actionUrl,
        method: method,
        dataType: "json",
        beforeSend: function () { },
        success: function (response) {
            toastr.remove();
            if (response.status) {
                $('form#addEditForm .modal-title').text('Edit');
                $('form#addEditForm [name="master_id"]').val(response.data.id);
                $('form#addEditForm [name="name"]').val(response.data.name);
                $('form#addEditForm [name="profession"]').val(response.data.profession);
                $('form#addEditForm [name="bio"]').val(response.data.bio);
                $('form#addEditForm [name="awards"]').val(response.data.awards);
                $('form#addEditForm [name="tags"]').val(response.data.tags);
                $('form#addEditForm #mediaPreview').attr('src', response.data.photo);
                $("#addEditModal").modal('show');
            } else {
                toastr.error(response.message);
            }
        },
        error: function (response) {
            toastr.remove();
            //toastr.error(response.message);
            //fail_message(response.responseJSON.message);

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
        }
    });
}

function delete_data(id) {
    swal.fire({
        //title: 'Delete',
        icon: "warning",
        text: 'Are You Sure ?',
        imageWidth: 48,
        imageHeight: 48,
        showCloseButton: true,
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        confirmButtonText: 'Yes, Delete it!',
        cancelButtonColor: '#d33',
        confirmButtonColor: '#3085d6',
        width: 320,
        allowOutsideClick: false,
    }).then(function (result) {
        if (result.value) {
            var actionUrl = baseUrl + '/api/master/' + id;
            var method = "DELETE";
            $.ajax({
                url: actionUrl,
                method: method,
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
                    toastr.error(response.responseJSON.message);
                }
            });
        }
    });
}

function change_status(id, status) {
    var actionUrl = baseUrl + '/api/master/' + id + '/changeStatus/' + status;
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
                toastr.success(response.message);
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

function trending_change_status(id, status) {
    var actionUrl = baseUrl + '/api/master/' + id + '/trendingchangeStatus/' + status;
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
                toastr.success(response.message);
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

function resetForm() {
    $("form#addEditForm").trigger("reset");
    $("form#addEditForm").find('input[type="hidden"]').val('');
    $("form#addEditForm").find('span.error').text('');
    $("#mediaPreview").attr('src', 'https://placehold.co/250x350');
    $("form#addEditForm").find('input').removeClass('is-invalid');
}

// if (document.getElementById('photo') != undefined) {
//     document.getElementById('photo').addEventListener('change', function (event) {
//         const file = event.target.files[0];
//         const errorMessage = document.querySelector('.photo-error');
//         const preview = document.getElementById('mediaPreview');

//         // Clear previous error messages and preview
//         errorMessage.textContent = '';
//         preview.src = '';

//         if (!file) {
//             return;
//         }

//         // Check file size (2MB = 2 * 1024 * 1024 bytes)
//         if (file.size > 2 * 1024 * 1024) {
//             errorMessage.textContent = 'File size must not exceed 2MB.';
//             return;
//         }

//         const img = new Image();
//         img.onload = function () {
//             // Validate dimensions
//            if (img.width > 250 || img.height > 350) {
//                 errorMessage.textContent = 'Image dimensions must not exceed 250px width and 350px height.';
//                 return;
//             }

//             // Set the preview image
//             preview.src = URL.createObjectURL(file);
//         };

//         img.onerror = function () {
//             errorMessage.textContent = 'The selected file is not a valid image.';
//         };

//         // Read the file to load the image
//         img.src = URL.createObjectURL(file);
//     });
// }

$('#addEditModal').on('hidden.bs.modal', function () {
    resetForm();
    $(".error-message").remove();
});
