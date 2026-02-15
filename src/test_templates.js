export const testTemplateFlutter = `import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
// Replace these with your own Router and Page
// import 'package:mock_project/helpers/routes.dart';
// import 'package:mock_project/main.dart';
import 'package:integration_test/integration_test.dart';
import 'package:screenshot/screenshot.dart';

// Advanced trigger test: flutter drive --driver vetest/integration_test.dart --target vetest/test.dart

// On iPhone: use the original resolution
// On iPad: times the resolution by 2
const screenSize = Size(__WIDTH__, __HEIGHT__);

const targetedItemIds = [__ITEM_IDS__];

const projectId = __PROJECT_ID__;

const apiToken = '__API_TOKEN__'; // Use a valid API Token here

final options = Options(
  headers: {
    'api-token': apiToken,
  }
);

void main() {

  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('HomePage can scroll (and take screenshots)', (WidgetTester tester) async {

    final ScreenshotController screenshotController = ScreenshotController();

    // tester.view.physicalSize = screenSize;
    
    runApp(
      Screenshot(
        controller: screenshotController,
        child: const MyApp(
          // Replace this with your own page
          home: Routes.home,
        ),
      ),
    );

    await tester.pumpAndSettle(const Duration(seconds: 2));

    // Action STARTS

    // If you have any action to trigger before scrolling, put it here.

    // For example, if you want to click a button:
    // await tester.tap(find.byKey(Key('my_button')));
    // await tester.pumpAndSettle();

    // Action ENDS

    var currentNo = 0;
    const deleteUrl = 'https://testserver.elasticdash.com/api/designcomp/extension/screenshot/clear/$projectId';
    const uploadUrl = 'https://testserver.elasticdash.com/api/designcomp/extension/screenshot/base64';
    const endUrl = 'https://testserver.elasticdash.com/api/designcomp/project/loading/update/$projectId/3';

    // Screenshot the first screen before starting the scrolling
    try {
      await screenshotController
          .capture(delay: const Duration(milliseconds: 10))
          .then((capturedImage) async {
        print('Screenshot captured: $currentNo');
        print('Targeted item: \${targetedItemIds[currentNo]}');
        var targetedItemId = targetedItemIds[currentNo];
        if (capturedImage != null) {
          print('Screenshot not null, proceed to upload.');
          final base64Value = uint8ListToBase64(capturedImage);

          return Dio().delete(deleteUrl, options: options)
          .then((res) {
            print('Screenshot deleted successfully.');

            return Dio().post(uploadUrl, data: {
              'items': [
                {
                  'name': 'scrollable_\${currentNo}_\${DateTime.now().millisecondsSinceEpoch}',
                  'base64': 'data:image/png;base64,$base64Value',
                  'campaignId': 1,
                  'itemId': targetedItemIds[currentNo],
                  'relevantAction': '',
                  'projectId': projectId
                }
              ],
            },
            options: options)
            .then((res) {
              print('Screenshot uploaded successfully.');

              return currentNo;
            });
          });
        }
        else {
          print('Screenshot is null, skip.');

          return currentNo;
        }
      }).catchError((onError) {
        print('screenshotController.capture failed 1, error $onError');
      });
    }
    catch(err) {
      print('Error: $err');
    }

    currentNo++;

    currentNo = await scrollEachItem(tester, screenshotController, currentNo);
    
    print('currentNo: $currentNo');

    await Dio().get(endUrl, options: options);

    await delayed(milliseconds: 500);
  });
}

Future<int> scrollEachItem(
  WidgetTester tester,
  ScreenshotController screenshotController,
  int currentNo,
) async {
  print('scrollEachItem is triggered');
  // First approach: get a single scrollable widget and drag it
  final scrollableElements = <Widget>[];

  // This will only contain the widgets that have been loaded.
  // By default, this means the widgets that are in the current viewport, due to lazy loading.
  // Which means that this would need to be re-run after each scroll to get the next set of widgets.
  final allWidgets = tester.allWidgets;

  for (final widget in allWidgets) {
    if (widget is ListView ||
        widget is ScrollView ||
        widget is SingleChildScrollView ||
        widget is CustomScrollView ||
        widget is NestedScrollView) {
      scrollableElements.add(widget);
    }
  }

  // If no scrollable element found, abort.
  if (scrollableElements.isEmpty) {
    print('scrollableElements is empty, abort');
    return currentNo;
  }
  else {
    print('scrollableElements is not empty, proceed');

    print('scrollableElements.length: \${scrollableElements.length}');

    // Otherwise, start screenshoting.
    // The following tasks should be done:
    // 1. If no element exists in the current viewport, take screenshot and then scroll down.
    // 2. If any element exists in the current viewport, adjust the viewport to contain the whole element, take screenshot and then scroll down on that element until reach its bottom.
    // 3. Repeat the above steps until the bottom of the page is reached.

    for (final scrollable in scrollableElements) {

      print('Discovered scrollable type: \${scrollable.runtimeType.toString()}');

      final scrollableFinder = find.byWidget(scrollable);

      try {
        tester.firstWidget<Widget>(scrollableFinder);
        print('Element found. Proceed.');

        final screenSize = tester.getSize(scrollableFinder);

        print('Checkpoint 1');

        print('scrollableFinder: $scrollableFinder');

        print('screenSize: $screenSize');

        final scrollableSize = screenSize.height;

        print('Checkpoint 2');

        final offset = Offset(0, -scrollableSize); // (Breaks) Vertical upwards dragging, moving downwards
        
        print('Checkpoint 3');

        var i = 0;

        // Repeat 5 times
        while (i < 5) {
          print('Dragging: $currentNo');
          // Drag from top to bottom with a slight offset to ensure enough movement
          print('screenSize.center(Offset.zero): \${screenSize.center(Offset.zero)}');

          await tester.pumpAndSettle();

          print('Checkpoint W 0');
          
          /*
          UPDATE: The screen turns blank not because of any element.
          It triggers if the page is scrollable vertically.
          */
          await tester.dragFrom(screenSize.center(Offset.zero), offset);

          print('Checkpoint W 1');
          
          print('Checkpoint W 2');

          await tester.pumpAndSettle(); // Wait for UI to rebuild after scroll
          
          print('Checkpoint W 3');

          await tester.pumpAndSettle();
          
          expect(find.textContaining('Pizza with Tomato Sauce'), findsAtLeastNWidgets(1));

          print('Dragging $currentNo completed, proceed to screenshot taking.');

          try {
            if (targetedItemIds.length > currentNo) {
              print('Screenshot the current item: $currentNo');
              await screenshotController
                  .capture(delay: const Duration(milliseconds: 10))
                  .then((capturedImage) async {
                print('Current NO: $currentNo');
                print('targetedItemIds.length: \${targetedItemIds.length}');
                if (capturedImage != null) {
                  print('Screenshot not null, proceed to upload.');
                  final base64Value = uint8ListToBase64(capturedImage);
                  final key = scrollable.key;
                  final keyToString = key != null ? key.toString().replaceFirst('[String <', '').replaceFirst('>]', '') : 'null';
                  print('keyToString: $keyToString');
                  return Dio().post('https://testserver.elasticdash.com/api/designcomp/extension/screenshot/base64', data: {
                    'items': [
                      {
                        'name': 'scrollable_\${currentNo}_\${DateTime.now().millisecondsSinceEpoch}',
                        'base64': 'data:image/png;base64,$base64Value',
                        'campaignId': 1,
                        'itemId': targetedItemIds[currentNo],
                        'relevantAction': 'Scroll down at the center of Widget (key: $keyToString) (\${screenSize.center(Offset.zero)}) for $offset pixels'
                      }
                    ],
                  },
                  options: options)
                  .then((res) {
                    print('Screenshot uploaded successfully.');

                    return currentNo;
                  });
                }
                else {
                  print('Screenshot is null, skip.');

                  return currentNo;
                }
              }).catchError((onError) {
                print('screenshotController.capture failed 2, error $onError');
              });
            }
            else {
              print('currentNo has gone beyond the length, skip.');
              print('Current NO: $currentNo');
              print('targetedItemIds.length: \${targetedItemIds.length}');
              break;
            }
          }
          catch(err) {
            print('Error: $err');
          }

          print('Checkpoint W 4');

          print('Screenshot completed, proceed to next iteration.');

          i++;

          currentNo++;
          
          print('Checkpoint W 5');
        }
      }
      catch(err) {
        print('Element not found. err: $err');
      }

    }

    return currentNo;
  }
}

String uint8ListToBase64(Uint8List uint8List) {
  // Encode the uint8List to Base64
  String base64String = base64Encode(uint8List);
  return base64String;
}

Future<dynamic> delayed ({int milliseconds = 666}) async {
  /// 适当延时，让操作节奏慢下来
  return Future<dynamic>.delayed(Duration(milliseconds: milliseconds));
}

const Duration scrollDuration = Duration(milliseconds: 300);
`