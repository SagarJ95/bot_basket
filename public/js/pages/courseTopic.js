
var topictable = $("#topic_data_table").DataTable({
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
    "language": {
        "lengthMenu": "Show _MENU_",
    },
    "dom": "<'row mb-2'" +
        "<'col-sm-6 d-flex align-items-center justify-conten-start dt-toolbar'l>" +
        "<'col-sm-6 d-flex align-items-center justify-content-end dt-toolbar'f>" +
        ">" +
        "<'table-responsive'tr>" +
        "<'row'" +
        "<'col-sm-12 col-md-5 d-flex align-items-center justify-content-center justify-content-md-start'i>" +
        "<'col-sm-12 col-md-7 d-flex align-items-center justify-content-center justify-content-md-end'p>" +
        ">",
    "buttons": [{
        extend: 'excel',
        text: 'EXCEL',
        title: "Craft school - course topic",
        filename: 'course_' + new Date().getTime(),
        exportOptions: {
            columns: ':not(:gt(-3))' // Exclude the last 2 columns (Actions)
        }
    },
    {
        extend: 'csv',
        text: 'CSV',
        title: "Craft school - course topic",
        filename: 'course_' + new Date().getTime(),
        exportOptions: {
            columns: ':not(:gt(-3))' // Exclude the last 2 columns (Actions)
        }
    },
    {
        extend: 'pdfHtml5',
        text: 'PDF',
        title: "Craft school - course topic",
        filename: 'course_' + new Date().getTime(),
        exportOptions: {
            columns: ':not(:gt(-3))' // Exclude the last 2 columns (Actions)
        }
    },
    ],
    "processing": true,
    "serverSide": true,
    "serverMethod": "post",
    "ajax": {
        "url": "/api/getCourseTopics",
        "accept": "application/json",
        "data": function (d) {
            d.course_id = $("#topic_page_course_id").val(); // Replace with your key-value pair
        },
        "beforeSend": function (xhr) {

        },
    },

    "columns": [{ data:"id", className: "text-center fs-6", visible:false},
        {
        data: "ordering",
        className:"text-center"
    },{
        data: "course_name"
    },
    {
        data: "topic"
    },
    {
        data: "description"
    },
    {
        data: "topic_video",
        className:"no-reorder",
    },
    {
        data: "video_duration"
    },
    {
        data: "free_video",
        className:"text-center"
    },
    {
        data: "status",
         className:"no-reorder"
    },

    // {
    //     data: "created_by"
    // },

    {
        data: "updated_by"
    },

    {
        data: "action",
        searchable: false,
        orderable: false,
        className: "w-150px no-reorder",
    }
    ]
});

topictable.on('row-reorder', function (e, diff, edit) {
    if (diff.length) {
      let reorderedData = [];

      // Loop through the reordered rows (from 'diff')
      for (let i = 0; i < diff.length; i++) {
        let rowData = topictable.row(diff[i].node).data();
        reorderedData.push({
            id: rowData.id,  // Use the unique ID for each row (assuming 'ordering' is the ID)
            new_position: diff[i].newPosition + 1  // The new position starts from 1
        });
    }

    // Loop through all rows in the table to capture rows that were not reordered
    topictable.rows().every(function (rowIdx) {
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
          url: baseUrl + "/api/updateCourseTopicOrder",
          type: "PATCH",
          headers: { "Accept": "application/json" },
          data: JSON.stringify(reorderedData),
          contentType: "application/json",
          success: function(response) {
           //   console.log('Order updated successfully:', response);
           topictable.ajax.reload();  // Reload table if needed
          },
          error: function(error) {
              console.error('Error updating order:', error);
          }
      });
  }
});

topictable.on('draw', function () {
    if ($('[data-bs-toggle="tooltip"]') !== undefined) {
        $('[data-bs-toggle="tooltip"]').tooltip();
    }
});

function change_topic_status(id, status) {
    var actionUrl = baseUrl + '/api/change_topic_status';

    $.ajax({
        url: actionUrl,
        method: "POST",
        data: {topic_id:id, status: status },
        dataType: "json",
        beforeSend: function () { },
        success: function (response) {

            if (response.status) {
                success_message(response.message);
                $('#topic_data_table').DataTable().ajax.reload();
            } else {
                fail_message(response.message);
            }
        },
        error: function (response) {

            fail_message(response.message);
        }
    });
}


function edit_topic_data(id) {
    var actionUrl = baseUrl + '/api/get_particular_course_topic';

    $.ajax({
        url: actionUrl,
        method: "POST",
        data: {topic_id:id},
        dataType: "json",
        beforeSend: function () { },
        success: function (response) {

            if (response.status) {
                $("#topic_id").val(response.data.id);
                $("#topic").val(response.data.topic);
                $("#description").val(response.data.description);
                $("#video_duration").val(response.data.video_duration);
                $(".topic_video_view_div").removeClass('d-none');
                var topic_video=response.data.topic_video;
                if (topic_video) {
                    topic_video = topic_video.replace(/public\\/, "");
                    topic_video = topic_video.replace(/\\/g, "/");
                }
                $("#topic_video_view").attr('href',topic_video);
            } else {
                fail_message(response.message);
            }
        },
        error: function (response) {

            fail_message(response.message);
        }
    });
}

function delete_topic_data(id) {
    console.log(id)
    Swal.fire({
        text: "Are you sure you want to delete topic?",
        icon: "warning",
        showCancelButton: true,
        buttonsStyling: false,
        confirmButtonText: "Yes, delete!",
        cancelButtonText: "No, cancel",
        customClass: {
            confirmButton: "btn fw-bold btn-danger",
            cancelButton: "btn fw-bold btn-active-light-primary"
        }
    }).then(function (result) {
        if (result.value) {

            var data = {
                topic_id: id
            }
            $.ajax({
                url: '/api/final_delete_course_topic',
                method: "POST",
                data: data,
                DataTypes: "JSON",
                beforeSend: function (xhr) {


                },
                success: function (response) {
                    $(".indicator-progress").hide()
                    if (response.status) {

                        success_message(response.message);
                        $('#topic_data_table').DataTable().ajax.reload();
                    } else {
                        fail_message(response.message);
                    }

                },
                error: function (response) {
                    fail_message(response.message);

                }
            });

            //});
        } else if (result.dismiss === 'cancel') {
            Swal.fire({
                text: customerName + " was not deleted.",
                icon: "error",
                buttonsStyling: false,
                confirmButtonText: "Ok, got it!",
                customClass: {
                    confirmButton: "btn fw-bold btn-primary",
                }
            });
        }
    });
}

$('#topic_video').on('change', function () {
    const file = this.files[0];

    if (file) {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = function () {
        window.URL.revokeObjectURL(video.src); // Release object URL

        const duration = video.duration; // Get duration in seconds

        // Convert duration to hours, minutes, and seconds
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = Math.floor(duration % 60);

        // Format the result as HH:MM:SS
        const formattedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        $('#video_duration').val(formattedDuration);
      };

      video.src = URL.createObjectURL(file);
    }
  });


  $("#course_topic_button").click(function(){
    var formData = new FormData($("#topic_data_form")[0]);
    if ($("#topic_id").val() == '') {
        url =baseUrl + "/api/add_course_topic";
    }
    else {
        url=baseUrl + "/api/update_topic";
    }
    $.ajax({
        url: url,
        method: "POST",
        data: formData,
        processData: false,
        contentType: false,
        beforeSend: function (xhr) {
            $(".indicator-progress").show()
            $("#course_topic_button").attr('disabled', true);
        },
        success: function (response) {
            $(".indicator-progress").hide()
            $(".error-message").remove();
            if (response.status) {
                success_message(response.message);
                $("#topic").val('')
                $("#topic_id").val('')
                $("input[name='topic_video']").val('');
                $("#description").val('');
                $("#video_duration").val('');
                $(".topic_video_view_div").addClass('d-none');
                $('#topic_data_table').DataTable().ajax.reload();
            } else {
                fail_message(response.message);
            }
            $("#course_topic_button").attr('disabled', false);
        },
        error: function (response) {
            $(".indicator-progress").hide()
            $("#course_topic_button").attr('disabled', false);

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
});

