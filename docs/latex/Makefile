TEX = xelatex
OPTS = -shell-escape -interaction=nonstopmode -synctex=1
TARGET = USER-GUIDE

.PHONY: all clean view

all: $(TARGET).pdf

$(TARGET).pdf: $(TARGET).tex
	$(TEX) $(OPTS) $(TARGET)
	$(TEX) $(OPTS) $(TARGET)

view: $(TARGET).pdf
	xdg-open $(TARGET).pdf

clean:
	rm -f *.aux *.log *.out *.toc *.lof *.lot *.synctex.gz *.pyg *.fdb_latexmk
	rm -rf _minted-$(TARGET)/
