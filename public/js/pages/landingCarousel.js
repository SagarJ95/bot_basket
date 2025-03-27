if (document.getElementById('carousel_table') != undefined) {
    var table = $("#carousel_table").DataTable({
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
        "ajax": {
            "url": baseUrl + "/api/getlandingCarousels",
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
            { data:"ordering", className: "text-center fs-6"},
            { data: "carousel_image", className: "text-center fs-6",orderable:false },
            { data: "status",className: "no-reorder",visible:isActionVisible },
            //{ data: "created_by", className: "text-center fs-6" },
            { data: "updated_by", className: "text-center fs-6" },
            {
                data: "action",
                orderable: false,
                searchable: false,
                className: "text-center no-reorder",
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
            url: baseUrl + "/api/updateCarouselOrder",
            type: "PATCH",
            headers: { "Accept": "application/json" },
            data: JSON.stringify(reorderedData),
            contentType: "application/json",
            success: function(response) {
             //   console.log('Order updated successfully:', response);
                table.ajax.reload();  // Reload table if needed
            },
            error: function(error) {
                console.error('Error updating order:', error);
            }
        });
    }
  });

  table.on('draw', function () {
      // if ($('[data-bs-toggle="tooltip"]') !== undefined) {
      //    / $('[data-bs-toggle="tooltip"]').tooltip();
      // }
  });


}

Dropzone.autoDiscover = false;

var myDropzone = new Dropzone("#kt_dropzonejs_example_1", {
    url: "/upload", // This will be handled manually via AJAX
    paramName: "file",
    maxFiles: 10,
    maxFilesize: 5,
    acceptedFiles: ".jpg,.jpeg,.svg,.png",
    addRemoveLinks: true,
    parallelUploads: 10,
    autoProcessQueue: false, // Prevent automatic upload
    dictDefaultMessage: "Drop images here or click to upload.",

    previewTemplate: `
        <div class="dz-preview dz-file-preview">
            <img data-dz-thumbnail />
            <a class="dz-remove" href="javascript:void(0);" data-dz-remove>Remove</a>
        </div>`,

    init: function() {
        var submitButton = document.querySelector("#saveButton");
        var dz = this;

        dz.on("addedfile", function(file) {
            if (dz.files.length > dz.options.maxFiles) {
                dz.removeFile(file);
                toastr.error('You can upload a maximum of 10 files.');
            } else {
                submitButton.disabled = false;
            }
        });

        dz.on("removedfile", function() {
            if (dz.files.length === 0) {
                submitButton.disabled = true;
            }
        });

        dz.on("error", function(file, message) {
            if (file.size > dz.options.maxFilesize * 1024 * 1024) {
                dz.removeFile(file);
                toastr.error('File size exceeds 5 MB!');
            } else if (!file.name.match(/\.(jpg|jpeg|svg|png)$/i)) {
                dz.removeFile(file);
                toastr.error('Only PNG, JPG and SVG files are allowed!');
            } else {
                toastr.error(message);
            }
        });

        submitButton.addEventListener("click", function(e) {
            e.preventDefault();
            $("#addEditForm").submit(); // Trigger form submission manually
        });
    }
});

// Submit form with images
$('#addEditForm').submit(function(e) {
    e.preventDefault();

    var formData = new FormData(this); // Get form fields data


    myDropzone.files.forEach((file) => {
        formData.append('landing_carousel[]', file);  // Use 'files[]' to match Multer's expected field name
    });


    // Send data via AJAX
    $.ajax({
        url: baseUrl + "/api/landingCarousel", // Change to your upload endpoint
        type: "POST",
        data: formData,
        contentType: false,
        processData: false,
        headers: {
            Accept: 'application/json',
        },
        success: function(response) {
            //toastr.success("Files uploaded successfully!");
            success_message("Files uploaded successfully!");
            $("#addEditModal").modal("hide"); // Close modal after success
            myDropzone.removeAllFiles(true); // Clear Dropzone files
            table.ajax.reload();
        },
        error: function(xhr) {
            //toastr.error("Failed to upload files.");
            fail_message(response.message);
        }
    });
});

//edit image
$("form#EditImageForm").on("submit", function (e) {
    e.preventDefault();

    var form = $(this);
    var formData = new FormData(form[0]);

    const id = $("[name='carousel_id']").val();

    var actionUrl = '/api/landingCarousel/' + id;
    var method = "PATCH" ;

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
                $("#EditImageModal").modal('hide');
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
            if (response.responseJSON.errors) {
                Object.entries(response.responseJSON.errors).forEach(([fieldName, errorMsg]) => {
                    const field = $(`[name="${fieldName}"]`);
                    if (field.length) {
                        form.find('span.' + fieldName + '-error').text(errorMsg);
                    }
                });
            }
        }
    });
});

function edit_data(id) {
    var actionUrl = baseUrl + "/api/landingCarousel/" + id;
    var method = "GET";
    $.ajax({
      url: actionUrl,
      method: method,
      dataType: "json",
      beforeSend: function () {},
      success: function (response) {
        toastr.remove();
        if (response.status) {
          $("#EditImageModal").modal("show");
          $('form#EditImageForm [name="carousel_id"]').val(response.data.id);
          $('form#EditImageForm #mediaPreview').attr('src', response.data.photo);
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
        var actionUrl = baseUrl + "/api/landingCarousel/" + id;
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
              //table.ajax.reload();
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
  var actionUrl = baseUrl + '/api/landingCarousel/' + id + '/changeStatus/' + status;
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
