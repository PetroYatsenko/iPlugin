(function($, window, document, undefined) {

    // Create the defaults once
    var pluginName = 'cardApp',
    defaults = {
        fontsBasePath: '/'
    };

    // The actual plugin constructor
    function CardApp(element, options) {
        this.element = element;
        this.options = $.extend({}, defaults, options);
        this.product = {colors: {}, fonts: {}};
        this._defaults = defaults;
        this._name = pluginName;

        this.init();
    }

    CardApp.prototype = {
        init: function() {
            var options = this.options,
                self = this;
            //loading templates
            $.get('../src/templates.html').then(function(data) {
                $(self.element).before($(data));
                $.ajax({
                    url: options.xmlPath,
                    success: function(data) {
                        self._handleResponse(data);
                    },
                    dataType: 'xml'
                });
            });
        },
        
        /**
         * handle response
         * @param {Object} data card data XML
         */
        _handleResponse: function(data) {
            this.product.data = $(data);
            this._parseCard();

        },
        
        /**
         * process card XML
         */
        _parseCard: function() {
            this._setColors();
            this._setFonts();
            this.initDocument();
        },
        
        /**
         * Init document
         * @returns {undefined}
         */
        initDocument: function() {
            var self = this,
                $document = this.product.data.find("Document"),
                region = $document.find('Region'),
                regionAttr = region.getAttributes(),
                blocks = $document.find('Block');

            var template = Handlebars.compile($('#card_tpl').html());
            var documentRegion = self
                ._getDocumentRegion(region.find('WebSettings').getAttributes());

            $(this.element).addClass('cardApp');
            
            // set background image
            $(this.element).html(template({
                img: regionAttr.WebImage,
                frameWidth: documentRegion.width,
                frameHeight: documentRegion.height,
                topRegion: documentRegion.top,
                leftRegion: documentRegion.left
              }));


            // init document blocks
            blocks.each(function() {
                self.initDocumentBlock($(this), documentRegion);
            });


            $(document).mouseup(function(e)
            {
                var container = $(".document_block");

                if (!container.is(e.target) // if the target of the click isn't the container...
                        && container.has(e.target).length === 0) // ... nor a descendant of the container
                {
                    self._hideEditorToolbar($(this).find('.document_block_wrapper'));
                }
            });

            $(self.element).on('focus', '.document_content', function(event) {
                self._hideEditorToolbar($(this).closest('#card').find('.document_block_wrapper'));
                self._showEditorToolbar($(this).closest('.document_block_wrapper'));
                event.stopPropagation();
            }).on('click', '.save_card', function() {
                self.saveCard(self);
            });

        },
        /**
         * Save card changes
         */
        saveCard: function(self) {
            var processedCardData = self._processCardData(),
                    template = Handlebars.compile($('#modal_dialog_tpl').html());

            $(self.element).append(template({content: processedCardData})); //

            var dialog = $(self.element).find('#modifiedXML');
            dialog.modal('show');
            dialog.on('shown.bs.modal', function() {
                SyntaxHighlighter.highlight();
            });
            dialog.on('hidden.bs.modal', function() {
                dialog.remove();
            });
        },
                
        /**
         * Prepare changed card data for saving
         * @returns {undefined}
         */
        _processCardData: function() {
            var self = this,
                card_data = $(self.product.data.children()[0]);

            card_data.find('Block').each(function() {
                var block_id = $(this).attr('ID');
                var $text = $(this).find('Text');
                var $edited_block = $(self.element).find('.document_block[data-id=' + block_id + ']');

                var settings = $text.children();
                $text.text($edited_block.find('.document_content').text().trim()); //save text
                $text.prepend(settings);
                $text.attr('FontFace', $edited_block.find('.font-box').attr('data-font')); //save font face
                $text.attr('FontColor', $edited_block.find('.color-box').attr('data-color')); //save font color
            });
            return (new XMLSerializer()).serializeToString(card_data[0]);;
        },

        /**
         * Init document block
         * @param {type} $block
         * @returns {undefined}
         */
        initDocumentBlock: function(block, documentRegion) {
            var self = this,
                options = self.options,
                textPosition = self._getTextPosition(block),
                blockAttr = block.getAttributes(),
                text = block.find('Text'),
                textAttr = text.getAttributes();

            var template = Handlebars.compile($('#document_block_tpl').html());

            $(this.element).find('.frame').append(template({
                id: blockAttr.ID,
                content: text.text().trim().replace(/\n/g, '<br/>'),
                fontSize: textAttr.FontSize,
                fontColor: self.product.colors[textAttr.FontColor],
                left: 0,
                top: textPosition['top']/documentRegion.height * 100,
                fontFamily: textAttr.FontFace,
                textStyle: [
                    {styleAttribute: 'text-decoration', value: 'underline', flag: textAttr.Underline},
                    {styleAttribute: 'font-weight', value: 'bold', flag: textAttr.Bold},
                    {styleAttribute: 'font-style', value: 'italic', flag: textAttr.Italic},
                ]
            }));

            var documentOptions = {
                defaultFont: textAttr.FontFace,
                defaultColor: self.product.colors[textAttr.FontColor],
                defaultColorName: textAttr.FontColor,
                blockText: text
            };

            self.initDocumentEditor(
               $(this.element)
               .find('.document_block[data-id=' + blockAttr.ID + ']'),
               documentOptions
            );
        },
                
        /**
         * Create array[colorName=>rgbValue] of colors from card XML
         */
        _setColors: function() {
            var self = this,
                colors = this.product.data.find("AvailableColors").find('Color');
            colors.each(function() {
                self.product.colors[ $(this).attr('Name') ] = $(this).attr('RGB');
            });
        },
                
        /**
         * Create array[fontName=>pathToFont] of fonts from card XML
         */
        _setFonts: function() {
            var self = this,
                fonts = this.product.data.find("AvailableFonts").find('Font');

            fonts.each(function() {
                var ttf = $(this).attr('TTF')
                var font_name = $(this).attr('Name')
                self.product.fonts[ font_name ] = ttf;

                //$.ajax({
                //    url: self.options. + ttf
                //});

                var font_style = "@font-face {\n\
                    font-family: '" + font_name + "'; \n\
                    src: url('" + self.options.fontsBasePath + ttf + "')  \n\
                    format('truetype');\n\};";
                $('head')
                .append(('<style type="text/css">' + font_style + '</style>'));
            });

        },
                
        /**
         * Return text postion
         */
        _getTextPosition: function(block) {
            var position = block.find('WebSettings').attr('TextPosition').split(',');
            return {
                left: position[0],
                top: position[1]
            };
        },
                
        /**
         * Show Editor toolbar
         */
        _showEditorToolbar: function(doc) {
            doc.find('.editor-toolbar').show();
        },
                
        /**
         * Hide editor toolbar 
         */
        _hideEditorToolbar: function(doc) {
            doc.find('.editor-toolbar').hide();
        },

        /**
         * Initialize and attach editior toolbar to document
         * @param {type} $doc - document link
         * @param {type} editorOptions - editro options
         */
        initDocumentEditor: function(doc, editorOptions) {
            var self = this,
                options = self.options;

            var toolbar_tpl = Handlebars.compile($('#editor_toolbar_tpl').html());
            doc.prepend(toolbar_tpl({
                colors: self.product.colors,
                fonts: self.product.fonts,
                defaultFont: editorOptions.defaultFont,
                defaultColor: editorOptions.defaultColor,
                defaultColorName: editorOptions.defaultColorName
            }));

            doc
            .on('click', '.color-item', function(e) {
                var selectedColor = $(this).data('background');
                var colorName = $(this).data('color');
                var colorGroup = $(this).parents('.btn-group');
                colorGroup.find('.color-box')
                .css({'background-color': 'rgb(' + selectedColor + ')'})
                .attr('data-color', colorName);
                $(e.delegateTarget).find('.document_content')
                .css({'color': 'rgb(' + selectedColor + ')'});
            })
            .on('click', '.font-item', function(e) {
                var selectedFont = $(this).data('font');
                var fontGroup = $(this).parents('.btn-group');
                $(e.delegateTarget).find('.font-box')
                .attr('data-font', selectedFont).text(selectedFont);
                $(e.delegateTarget).find('.document_content')
                .css({'font-family': selectedFont});
            });
        },
                
        /**
         * Return region position
         * @param {type} regionAttr - region attributes
         */
        _getDocumentRegion: function(regionAttr) {
            var documentRegion = regionAttr.DocumentRegion.split(','),
                regionPosition = {
                    width: documentRegion[2] - documentRegion[0],
                    height: documentRegion[3] - documentRegion[1],
                    top: documentRegion[0],
                    left: documentRegion[1]
                }
            return regionPosition;
        }
    }

    /**
     * Constructor wrapper
     */
    $.fn.cardApp = function(options) {
        return this.each(function() {
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName,
                        new CardApp(this, options));
            }
        });
    }

    /**
     * Return array of tag attributes
     */
    $.fn.getAttributes = function() {
        var attributes = {};

        if (this.length) {
            $.each(this[0].attributes, function(index, attr) {
                attributes[ attr.name ] = attr.value;
            });
        }

        return attributes;
    };

    /**
     * Check flag for setting styleAttribute
     * Obj = {styleAttribute, value, flag}
     * styleAttribute - attribute name
     * value - attribute value
     * flag - Y/N
     */
    Handlebars.registerHelper("checkTextStyle", function(obj) {
        if (obj.flag == 'Y') {
            var str = obj.styleAttribute + ':' + obj.value + ';';
            return str;
        }
        return '';
    });
})(jQuery, window, document);
